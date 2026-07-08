import { Crosshair, Minus, Orbit, Plus, RotateCcw, Wrench, Zap } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_COLORS, CATEGORY_ICONS, getSourceAccent } from "../constants.js";
import { drawAuroraVeil, drawFilament, drawGlow, drawTendril, hexToRgb } from "../lib/plasma.js";
import { getActivityFor } from "../lib/usage.js";
import {
  DEFAULT_CAM,
  SPHERE_RADIUS_PX,
  VIEW_CX,
  VIEW_CY,
  buildSphereEdges,
  computeBaseVectors,
  ringPath,
  rotateVec,
  SHELL_RINGS,
  shortestAngle,
  vectorToRotation,
  normalizeVec
} from "../lib/sphere.js";
import { clamp, hashString } from "../lib/utils.js";

const SOURCE_PRIORITY = { Personal: 0, System: 1, Plugin: 2 };

function sourceClassName(source) {
  return String(source).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function sourceLegendFor(skills) {
  return [...new Set(skills.map((skill) => skill.source))]
    .sort((a, b) => (SOURCE_PRIORITY[a] ?? 10) - (SOURCE_PRIORITY[b] ?? 10) || a.localeCompare(b));
}

function SphereGraph({
  skills,
  selectedSkill,
  relatedSkills,
  selectSkill,
  graphMode,
  unseenIds,
  focusNonce,
  highlightIds,
  activity
}) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const projRef = useRef({ items: [], byId: new Map(), radiusPx: SPHERE_RADIUS_PX });
  const frameRef = useRef({});
  const edgesRef = useRef([]);
  const rotRef = useRef({ yaw: -0.35, pitch: 0.16 });
  const velRef = useRef({ yaw: 0, pitch: 0 });
  const focusRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const lastInteractRef = useRef(0);
  const curVecRef = useRef(new Map());
  const hoverRef = useRef(null);
  const autoRef = useRef(true);
  const baseRef = useRef(new Map());

  const [, setTick] = useState(0);
  const [camDist, setCamDist] = useState(DEFAULT_CAM);
  const [hoveredId, setHoveredId] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [plasmaOn, setPlasmaOn] = useState(true);

  hoverRef.current = hoveredId;
  autoRef.current = autoRotate;

  const reducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
    []
  );

  const relatedMap = useMemo(() => {
    const map = new Map();
    relatedSkills.forEach((item, index) => map.set(item.skill.id, { ...item, rank: index }));
    return map;
  }, [relatedSkills]);

  // Snapshot of render-scoped state for the plasma-globe paint loop.
  frameRef.current = {
    plasmaOn,
    reduced: reducedMotion,
    highlightIds,
    selectedId: selectedSkill?.id ?? null,
    relatedMap,
    activity,
    camDist
  };

  // Plasma globe: a charged core at the sphere's centre discharges tendrils
  // outward to the skills that carry real energy. A tendril only reaches a
  // skill with actual Codex usage (brightness = heat); selecting a skill is
  // "touching the glass" — it always attracts the strong white arc.
  useEffect(() => {
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    if (!canvas || !svg) return;
    const ctx = canvas.getContext("2d");
    let raf = 0;

    const paint = () => {
      raf = window.requestAnimationFrame(paint);
      const state = frameRef.current;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);
      if (!state.plasmaOn) return;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const time = state.reduced ? 0 : performance.now() / 1000;
      const scale = matrix.a * dpr;
      const toCanvas = (x, y) => [
        (matrix.a * x + matrix.c * y + matrix.e - rect.left) * dpr,
        (matrix.b * x + matrix.d * y + matrix.f - rect.top) * dpr
      ];

      ctx.globalCompositeOperation = "lighter";

      const { items, byId, radiusPx } = projRef.current;
      const [cx, cy] = toCanvas(VIEW_CX, VIEW_CY);
      const coreR = radiusPx * scale;

      // The electrode: layered magenta core, gently pulsing.
      const pulse = state.reduced ? 1 : 1 + Math.sin(time * 1.3) * 0.06;
      drawGlow(ctx, cx, cy, coreR * 0.55 * pulse, "168,112,255", 0.09);
      drawGlow(ctx, cx, cy, coreR * 0.24 * pulse, "255,100,190", 0.3);
      drawGlow(ctx, cx, cy, coreR * 0.1 * pulse, "255,220,242", 0.6);

      // Aurora inside the glass: the auroral oval as seen from space — a
      // soft veil wrapped around the 3D globe itself. It projects through
      // the live rotation, so dragging the sphere carries the aurora with
      // it. The circular clip keeps everything inside the glass.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.clip();
      const rot = rotRef.current;
      const camDist = state.camDist ?? DEFAULT_CAM;
      const project3 = (p) => {
        const v = rotateVec(p, rot.yaw, rot.pitch);
        const persp = camDist / (camDist - v.z * 0.96);
        const [px, py] = toCanvas(VIEW_CX + v.x * radiusPx * persp, VIEW_CY - v.y * radiusPx * persp);
        return { x: px, y: py, z: v.z };
      };
      // Northern oval: teal-green with a pink equator-side fringe.
      drawAuroraVeil(ctx, {
        project: project3,
        radius: coreR,
        center: [cx, cy],
        lat: 1.08,
        time,
        speed: 1,
        phase: 1.7,
        mainRgb: "110,255,200",
        fringeRgb: "255,110,190",
        alpha: 0.24
      });
      // Southern counterpart: fainter, colder, drifting the other way.
      drawAuroraVeil(ctx, {
        project: project3,
        radius: coreR,
        center: [cx, cy],
        lat: -1.12,
        time,
        speed: -0.8,
        phase: 4.1,
        mainRgb: "140,190,255",
        fringeRgb: "220,120,255",
        alpha: 0.14
      });
      for (const item of items) {
        const { heat } = getActivityFor(state.activity, item.skill.id);
        if (heat < 0.4) continue;
        const bloomDepth = (item.z + 1) / 2;
        const [bnx, bny] = toCanvas(item.x, item.y);
        const sway = Math.sin(time * 0.6 + item.x * 0.02) * coreR * 0.04;
        drawGlow(
          ctx,
          bnx + sway,
          bny - sway,
          coreR * (0.15 + heat * 0.16),
          "255,90,170",
          (0.045 + heat * 0.05) * (0.35 + 0.65 * bloomDepth)
        );
      }
      ctx.restore();

      // Node-to-node relationships as plasma, replacing the straight SVG
      // lines entirely — one link language for the whole product.
      for (const edge of edgesRef.current) {
        const a = byId.get(edge.a);
        const b = byId.get(edge.b);
        if (!a || !b) continue;
        const depthAlpha = Math.min(a.alpha, b.alpha);
        if (depthAlpha <= 0.02) continue;
        const [ax, ay] = toCanvas(a.x, a.y);
        const [bx, by] = toCanvas(b.x, b.y);
        const phase = (hashString(edge.id) % 89) + 1;
        if (edge.kind === "related") {
          drawTendril(ctx, ax, ay, bx, by, {
            coreRgb: "205,250,255",
            sheathRgb: "140,244,255",
            alpha: Math.min(0.7, 0.22 + depthAlpha * 0.5),
            amp: Math.hypot(bx - ax, by - ay) * 0.1,
            phase,
            time,
            width: 0.9 * scale
          });
        } else {
          drawFilament(ctx, ax, ay, bx, by, {
            rgb: "172,150,255",
            alpha: depthAlpha * 0.12,
            amp: Math.hypot(bx - ax, by - ay) * 0.07,
            phase,
            time,
            width: 0.7 * scale,
            segments: 10
          });
        }
      }

      for (const item of items) {
        const { skill } = item;
        const { heat } = getActivityFor(state.activity, skill.id);
        const isSelected = skill.id === state.selectedId;
        const isRelated = state.relatedMap.has(skill.id);
        const isStruck = Boolean(state.highlightIds?.has(skill.id));
        if (heat <= 0 && !isSelected && !isRelated && !isStruck) continue;

        const depth = (item.z + 1) / 2;
        const depthScale = 0.22 + 0.78 * depth;
        let alpha = isSelected ? 0.8 : isStruck ? 0.6 : isRelated ? 0.3 : 0.1 + heat * 0.38;
        if (state.highlightIds && !isStruck && !isSelected) alpha *= 0.15;
        alpha *= depthScale;
        if (alpha <= 0.01) continue;

        const [nx, ny] = toCanvas(item.x, item.y);
        const distance = Math.hypot(nx - cx, ny - cy);
        drawTendril(ctx, cx, cy, nx, ny, {
          coreRgb: isSelected ? "255,255,255" : hexToRgb(getSourceAccent(skill.source)),
          sheathRgb: isStruck ? "140,244,255" : "182,110,255",
          alpha: alpha * 1.25,
          amp: distance * (0.09 + heat * 0.06),
          phase: (hashString(skill.id) % 89) + 1,
          time,
          jitter: isSelected && !state.reduced ? 5 * scale : heat > 0.5 ? 2.5 * scale : 0,
          width: (isSelected ? 1.5 : 0.6 + heat * 0.85) * scale,
          // No branches: stray sparks that end in empty space read as noise —
          // every line must land on a skill.
          branch: false
        });

        if (heat > 0) {
          drawGlow(
            ctx,
            nx,
            ny,
            (6 + heat * 20) * scale * depthScale,
            hexToRgb(getSourceAccent(skill.source)),
            (0.06 + heat * 0.3) * depthScale
          );
        }
      }
    };

    raf = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const { map: baseVectors, anchors } = useMemo(
    () => computeBaseVectors(skills, graphMode, selectedSkill, relatedMap, unseenIds),
    [skills, graphMode, selectedSkill, relatedMap, unseenIds]
  );
  baseRef.current = baseVectors;

  const edges = useMemo(
    () =>
      buildSphereEdges(
        skills,
        baseVectors,
        selectedSkill,
        relatedSkills,
        graphMode === "plugin" ? "plugin" : "category"
      ),
    [skills, baseVectors, selectedSkill, relatedSkills, graphMode]
  );
  edgesRef.current = edges;

  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => {
        const seed = hashString(`star-${index}`);
        return {
          x: seed % 900,
          y: (seed >> 7) % 600,
          r: 0.4 + ((seed >> 3) % 10) / 9,
          o: 0.05 + ((seed >> 5) % 22) / 100
        };
      }),
    []
  );

  // Keep per-node animated vectors in sync with the visible skill set.
  useEffect(() => {
    const current = curVecRef.current;
    const ids = new Set();
    for (const skill of skills) {
      ids.add(skill.id);
      if (!current.has(skill.id)) {
        const target = baseVectors.get(skill.id) ?? { x: 0, y: 0, z: 1 };
        const seed = hashString(skill.id);
        current.set(
          skill.id,
          normalizeVec({
            x: target.x + (((seed % 21) - 10) / 10) * 0.22,
            y: target.y + ((((seed >> 5) % 21) - 10) / 10) * 0.22,
            z: target.z
          })
        );
      }
    }
    for (const id of [...current.keys()]) {
      if (!ids.has(id)) current.delete(id);
    }
  }, [skills, baseVectors]);

  // Rotate the sphere so the selected skill drifts to the front.
  useEffect(() => {
    if (!selectedSkill) return;
    const vec = baseVectors.get(selectedSkill.id);
    if (!vec) return;
    focusRef.current = vectorToRotation(vec);
  }, [selectedSkill?.id, focusNonce, baseVectors]);

  // Animation loop: focus easing, drag inertia, idle auto-rotation, node drift.
  useEffect(() => {
    let raf = 0;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    const step = () => {
      const rot = rotRef.current;
      const vel = velRef.current;
      let changed = Boolean(dragRef.current);

      if (focusRef.current) {
        const dy = shortestAngle(focusRef.current.yaw - rot.yaw);
        const dp = focusRef.current.pitch - rot.pitch;
        const ease = reduced ? 0.4 : 0.08;
        rot.yaw += dy * ease;
        rot.pitch += dp * ease;
        changed = true;
        if (Math.abs(dy) < 0.004 && Math.abs(dp) < 0.004) focusRef.current = null;
      } else if (!dragRef.current) {
        if (Math.abs(vel.yaw) > 0.00014 || Math.abs(vel.pitch) > 0.00014) {
          rot.yaw += vel.yaw;
          rot.pitch += vel.pitch;
          changed = true;
        }
        vel.yaw *= 0.93;
        vel.pitch *= 0.93;
        const idle = performance.now() - lastInteractRef.current > 2400;
        if (autoRef.current && !reduced && idle && !hoverRef.current) {
          rot.yaw += 0.0015;
          changed = true;
        }
        rot.pitch = clamp(rot.pitch, -1.25, 1.25);
      }

      for (const [id, cur] of curVecRef.current) {
        const target = baseRef.current.get(id);
        if (!target) continue;
        const dx = target.x - cur.x;
        const dy2 = target.y - cur.y;
        const dz = target.z - cur.z;
        if (dx * dx + dy2 * dy2 + dz * dz > 0.00002) {
          const ease = reduced ? 0.5 : 0.07;
          cur.x += dx * ease;
          cur.y += dy2 * ease;
          cur.z += dz * ease;
          const length = Math.hypot(cur.x, cur.y, cur.z) || 1;
          cur.x /= length;
          cur.y /= length;
          cur.z /= length;
          changed = true;
        }
      }

      if (changed) setTick((value) => (value + 1) % 1e9);
      raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  // Drag anywhere on the graph rotates the sphere.
  const handlePointerDown = useCallback((event) => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    focusRef.current = null;
    lastInteractRef.current = performance.now();
  }, []);

  useEffect(() => {
    const handleMove = (event) => {
      if (!dragRef.current) return;
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      dragRef.current = { x: event.clientX, y: event.clientY };
      if (Math.abs(dx) + Math.abs(dy) > 2) movedRef.current = true;
      const rot = rotRef.current;
      const speed = 0.0052;
      rot.yaw -= dx * speed;
      rot.pitch = clamp(rot.pitch + dy * speed, -1.25, 1.25);
      velRef.current = { yaw: -dx * speed * 0.5, pitch: dy * speed * 0.5 };
      lastInteractRef.current = performance.now();
    };
    const handleUp = () => {
      dragRef.current = null;
      lastInteractRef.current = performance.now();
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  // Wheel zoom moves the camera closer or farther.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event) => {
      event.preventDefault();
      setCamDist((current) => clamp(current * (event.deltaY > 0 ? 1.08 : 0.925), 2.05, 5.2));
      lastInteractRef.current = performance.now();
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const focusSelected = useCallback(() => {
    if (!selectedSkill) return;
    const vec = baseRef.current.get(selectedSkill.id);
    if (!vec) return;
    focusRef.current = vectorToRotation(vec);
  }, [selectedSkill]);

  const resetView = () => {
    focusRef.current = { yaw: -0.35, pitch: 0.16 };
    velRef.current = { yaw: 0, pitch: 0 };
    setCamDist(DEFAULT_CAM);
    setAutoRotate(true);
  };

  const zoomBy = (direction) => {
    setCamDist((current) => clamp(current * (direction > 0 ? 0.86 : 1.16), 2.05, 5.2));
  };

  // Project every node for this frame.
  const rot = rotRef.current;
  const zoom = DEFAULT_CAM / camDist;
  const radiusPx = SPHERE_RADIUS_PX * zoom;

  const projected = [];
  for (const skill of skills) {
    const cur = curVecRef.current.get(skill.id) ?? baseVectors.get(skill.id);
    if (!cur) continue;
    const v = rotateVec(cur, rot.yaw, rot.pitch);
    const persp = camDist / (camDist - v.z * 0.96);
    const depth = (v.z + 1) / 2;
    const isSelected = selectedSkill?.id === skill.id;
    const isRelated = relatedMap.has(skill.id);
    let alpha = 0.15 + 0.85 * Math.pow(depth, 1.5);
    if (graphMode === "focus" && selectedSkill && !isSelected && !isRelated) alpha *= 0.4;
    if (highlightIds && !highlightIds.has(skill.id) && !isSelected) alpha *= 0.18;
    if (isSelected) alpha = 1;
    const baseRadius = isSelected ? 12.5 : skill.source === "Personal" ? 6.1 : skill.source === "System" ? 5.5 : 4.5;
    projected.push({
      skill,
      x: VIEW_CX + v.x * radiusPx * persp,
      y: VIEW_CY - v.y * radiusPx * persp,
      z: v.z,
      alpha,
      r: Math.max(1.6, baseRadius * persp * Math.pow(zoom, 0.5)),
      isSelected,
      isRelated
    });
  }
  projected.sort((a, b) => a.z - b.z);
  const projById = new Map(projected.map((item) => [item.skill.id, item]));
  projRef.current = { items: projected, byId: projById, radiusPx };

  // Cluster region labels for lenses with named regions.
  const clusterLabels = anchors
    .map((anchor) => {
      const v = rotateVec(anchor.vec, rot.yaw, rot.pitch);
      if (v.z < 0.18) return null;
      const persp = camDist / (camDist - v.z * 0.96);
      return {
        key: anchor.key,
        count: anchor.count,
        x: VIEW_CX + v.x * radiusPx * 1.06 * persp,
        y: VIEW_CY - v.y * radiusPx * 1.06 * persp,
        opacity: clamp((v.z - 0.18) * 1.5, 0, 0.9),
        color: graphMode === "sphere" ? CATEGORY_COLORS[anchor.key] ?? "#b8ccd3" : "#8cf4ff"
      };
    })
    .filter(Boolean);

  // Sparse labels: selected, hovered, mission matches, then front nodes.
  const labelIds = new Set();
  if (selectedSkill) labelIds.add(selectedSkill.id);
  if (hoveredId) labelIds.add(hoveredId);
  if (highlightIds) for (const id of highlightIds) labelIds.add(id);
  const labelBudget = skills.length <= 14 ? skills.length : zoom > 1.28 ? 13 : graphMode === "focus" ? 9 : 6;
  const frontSorted = [...projected].sort((a, b) => b.z - a.z);
  const sourceLegend = sourceLegendFor(skills);
  for (const item of frontSorted) {
    if (labelIds.size >= labelBudget + 2) break;
    if (item.z < 0.38) break;
    if (graphMode === "focus" && selectedSkill && !item.isRelated && !item.isSelected) continue;
    labelIds.add(item.skill.id);
  }

  return (
    <>
      <canvas ref={canvasRef} className="plasma-canvas" aria-hidden="true" />
      <svg
        ref={svgRef}
        className="sphere-graph"
        viewBox="0 0 900 600"
        role="img"
        aria-label="Rotatable 3D skill sphere"
        onPointerDown={handlePointerDown}
      >
        <defs>
          <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="selectedAura">
            <stop offset="0%" stopColor="#8cf4ff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#8cf4ff" stopOpacity="0" />
          </radialGradient>
          {/* Apple-style glass: essentially invisible — no interior haze,
              just a whisper of white right at the rim. The aurora inside is
              what reveals the sphere. */}
          <radialGradient id="sphereAtmos">
            <stop offset="0%" stopColor="#0a0a14" stopOpacity="0" />
            <stop offset="96%" stopColor="#eef4ff" stopOpacity="0" />
            <stop offset="99%" stopColor="#eef4ff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#eef4ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glassSpec">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="starfield" aria-hidden="true">
          {stars.map((star, index) => (
            <circle key={index} cx={star.x} cy={star.y} r={star.r} opacity={star.o} />
          ))}
        </g>

        <circle className="sphere-atmosphere" cx={VIEW_CX} cy={VIEW_CY} r={radiusPx * 1.04} fill="url(#sphereAtmos)" />
        <circle className="sphere-silhouette" cx={VIEW_CX} cy={VIEW_CY} r={radiusPx} />
        {/* Specular highlights: the room-light reflections that make it glass. */}
        <g aria-hidden="true">
          <ellipse
            cx={VIEW_CX - radiusPx * 0.36}
            cy={VIEW_CY - radiusPx * 0.52}
            rx={radiusPx * 0.34}
            ry={radiusPx * 0.15}
            transform={`rotate(-26 ${VIEW_CX - radiusPx * 0.36} ${VIEW_CY - radiusPx * 0.52})`}
            fill="url(#glassSpec)"
          />
          <ellipse
            cx={VIEW_CX + radiusPx * 0.32}
            cy={VIEW_CY + radiusPx * 0.58}
            rx={radiusPx * 0.2}
            ry={radiusPx * 0.07}
            transform={`rotate(-26 ${VIEW_CX + radiusPx * 0.32} ${VIEW_CY + radiusPx * 0.58})`}
            fill="url(#glassSpec)"
            opacity="0.45"
          />
        </g>

        <g className="shell-rings" aria-hidden="true">
          {SHELL_RINGS.map((points, index) => (
            <React.Fragment key={index}>
              <path className="shell-ring back" d={ringPath(points, rot, camDist, radiusPx, false)} />
              <path className="shell-ring front" d={ringPath(points, rot, camDist, radiusPx, true)} />
            </React.Fragment>
          ))}
        </g>

        {/* Straight SVG edges only as fallback when plasma is toggled off —
            with plasma on, links live on the canvas as filaments. */}
        {!plasmaOn ? (
          <g className="edge-field">
            {edges.map((edge) => {
              const a = projById.get(edge.a);
              const b = projById.get(edge.b);
              if (!a || !b) return null;
              const depthAlpha = Math.min(a.alpha, b.alpha);
              const related = edge.kind === "related";
              const opacity = related
                ? Math.min(0.9, 0.3 + depthAlpha * 0.55)
                : depthAlpha * (graphMode === "focus" ? 0.1 : 0.17);
              return (
                <line
                  key={edge.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={related ? "edge-related" : "edge-mesh"}
                  strokeOpacity={opacity}
                  strokeWidth={related ? 1.25 : 0.8}
                >
                  <title>{edge.reason}</title>
                </line>
              );
            })}
          </g>
        ) : null}

        <g className="cluster-labels" aria-hidden="true">
          {clusterLabels.map((label) => (
            <text
              key={label.key}
              className="cluster-label"
              x={label.x}
              y={label.y}
              style={{ fill: label.color, opacity: label.opacity }}
            >
              {label.key}
              <tspan className="cluster-count"> · {label.count}</tspan>
            </text>
          ))}
        </g>

        <g>
          {projected.map((item) => {
            const { skill, isSelected, isRelated } = item;
            const relationship = relatedMap.get(skill.id);
            const Icon = CATEGORY_ICONS[skill.category] ?? Wrench;
            const labelVisible = labelIds.has(skill.id);
            const isHovered = hoveredId === skill.id;
            const iconSize = Math.max(11, Math.min(18, item.r * 2));

            return (
              <g
                key={skill.id}
                className={`graph-node source-${sourceClassName(skill.source)} ${isSelected ? "selected" : ""} ${
                  isRelated ? "related" : ""
                }`}
                transform={`translate(${item.x.toFixed(1)} ${item.y.toFixed(1)})`}
                style={{ "--node-accent": getSourceAccent(skill.source), opacity: item.alpha }}
                role="button"
                tabIndex="0"
                aria-label={`Select ${skill.qualifiedName}`}
                onClick={() => {
                  if (!movedRef.current) selectSkill(skill.id);
                }}
                onPointerEnter={() => setHoveredId(skill.id)}
                onPointerLeave={() => setHoveredId((value) => (value === skill.id ? null : value))}
                onFocus={() => setHoveredId(skill.id)}
                onBlur={() => setHoveredId((value) => (value === skill.id ? null : value))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") selectSkill(skill.id);
                }}
              >
                <title>
                  {skill.qualifiedName}
                  {relationship ? ` — ${relationship.reasons[0]}` : ` — ${skill.category}`}
                </title>
                {isSelected ? <circle className="selected-aura" r={item.r * 3.6} /> : null}
                <circle className="hit-area" r={Math.max(item.r + 8, 13)} />
                {isSelected ? <circle className="selected-ring" r={item.r + 5.5} /> : null}
                {isRelated && !isSelected ? <circle className="related-ring" r={item.r + 3} /> : null}
                <circle className="node-core" r={item.r} />
                <circle className="icon-plate" r={Math.max(item.r + 4, 11)} />
                <foreignObject
                  className="node-icon"
                  x={-iconSize / 2}
                  y={-iconSize / 2}
                  width={iconSize}
                  height={iconSize}
                >
                  <Icon size={iconSize} strokeWidth={2} />
                </foreignObject>
                {labelVisible ? (
                  <text className="node-label" y={item.r + 13}>
                    {skill.name}
                  </text>
                ) : null}
                {labelVisible && (isSelected || isHovered) ? (
                  <text className="node-sub" y={item.r + 24}>
                    {graphMode === "plugin" ? skill.plugin : skill.category}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="graph-controls" aria-label="Sphere navigation">
        <button type="button" onClick={focusSelected} title="Center selected skill">
          <Crosshair size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(1)} title="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} title="Zoom out">
          <Minus size={16} />
        </button>
        <button
          type="button"
          className={autoRotate ? "active" : ""}
          onClick={() => setAutoRotate((value) => !value)}
          title={autoRotate ? "Pause auto-rotation" : "Resume auto-rotation"}
        >
          <Orbit size={16} />
        </button>
        <button
          type="button"
          className={plasmaOn ? "active" : ""}
          onClick={() => setPlasmaOn((value) => !value)}
          title={plasmaOn ? "Plasma off" : "Plasma on"}
        >
          <Zap size={15} />
        </button>
        <button type="button" onClick={resetView} title="Reset view">
          <RotateCcw size={15} />
        </button>
      </div>

      <div className="graph-legend" aria-hidden="true">
        {sourceLegend.map((label) => {
          const color = getSourceAccent(label);
          return (
            <span key={label}>
              <i style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
              {label}
            </span>
          );
        })}
      </div>

      <div className="graph-hint">
        <span>drag · rotate</span>
        <span>scroll · zoom</span>
        <span>click · activate</span>
      </div>
    </>
  );
}

export default SphereGraph;
