import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import { Crosshair, Flame, Minus, Pin, Plus, RotateCcw, Wrench, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_COLORS, CATEGORY_ICONS, getSourceAccent } from "../constants.js";
import { buildWebEdges, categoryAnchors, seedPosition, WEB_CX, WEB_CY, WEB_VIEW_H, WEB_VIEW_W } from "../lib/force.js";
import { drawFilament, drawGlow, drawStrike, hexToRgb } from "../lib/plasma.js";
import { getActivityFor } from "../lib/usage.js";
import { clamp, hashString } from "../lib/utils.js";

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 3;
const getZoomSpacing = (k) => 1 + Math.max(0, k - 1) * 0.34;
const getLinkDistance = (link, spacing = 1) => (46 + (1 - link.strength) * 58) * spacing;
const getChargeStrength = (spacing = 1) => -52 * spacing;
const getCollisionRadius = (spacing = 1) => 13 * spacing;
const SOURCE_PRIORITY = { Personal: 0, System: 1, Plugin: 2 };

function sourceClassName(source) {
  return String(source).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function sourceLegendFor(skills) {
  return [...new Set(skills.map((skill) => skill.source))]
    .sort((a, b) => (SOURCE_PRIORITY[a] ?? 10) - (SOURCE_PRIORITY[b] ?? 10) || a.localeCompare(b));
}

function ForceGraph({ skills, selectedSkill, relatedSkills, selectSkill, focusNonce, highlightIds, activity }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const posCacheRef = useRef(new Map());
  const dragRef = useRef(null); // { kind: "pan" | "node", ... }
  const movedRef = useRef(false);
  const viewRef = useRef({ tx: 0, ty: 0, k: 1 });
  const zoomSpacingRef = useRef(1);
  const strikesRef = useRef([]);
  const frameRef = useRef({});
  const lastStrikeKeyRef = useRef("");

  const [, setTick] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [plasmaOn, setPlasmaOn] = useState(true);

  const reducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
    []
  );

  const applyZoomSpacing = useCallback((k) => {
    const spacing = getZoomSpacing(k);
    zoomSpacingRef.current = spacing;
    const sim = simRef.current;
    if (!sim) return;
    sim.force("link")?.distance((link) => getLinkDistance(link, spacing));
    sim.force("charge")?.strength(getChargeStrength(spacing)).distanceMax(320 * spacing);
    sim.force("collide")?.radius(getCollisionRadius(spacing));
    sim.alpha(Math.max(sim.alpha(), 0.28)).restart();
  }, []);

  // Snapshot of render-scoped state for the plasma paint loop (which reads
  // refs only, so it never rebinds).
  frameRef.current = {
    plasmaOn,
    reduced: reducedMotion,
    highlightIds,
    selectedId: selectedSkill?.id ?? null,
    activity
  };

  const relatedMap = useMemo(() => {
    const map = new Map();
    relatedSkills.forEach((item, index) => map.set(item.skill.id, { ...item, rank: index }));
    return map;
  }, [relatedSkills]);

  const edges = useMemo(() => buildWebEdges(skills), [skills]);

  const anchors = useMemo(
    () => categoryAnchors([...new Set(skills.map((skill) => skill.category))]),
    [skills]
  );

  const degree = useMemo(() => {
    const map = new Map();
    for (const edge of edges) {
      map.set(edge.a, (map.get(edge.a) ?? 0) + 1);
      map.set(edge.b, (map.get(edge.b) ?? 0) + 1);
    }
    return map;
  }, [edges]);

  // Build (or rebuild) the simulation whenever the visible set changes.
  // Surviving nodes keep their positions so filter changes reheat smoothly
  // instead of exploding the layout.
  useEffect(() => {
    const cache = posCacheRef.current;
    const nodes = skills.map((skill) => {
      const prev = cache.get(skill.id) ?? seedPosition(skill, anchors);
      return { id: skill.id, skill, x: prev.x, y: prev.y };
    });
    const links = edges.map((edge) => ({ ...edge, source: edge.a, target: edge.b }));
    nodesRef.current = nodes;
    linksRef.current = links;

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink(links)
          .id((d) => d.id)
          .distance((link) => getLinkDistance(link, zoomSpacingRef.current))
          .strength((link) => 0.25 + link.strength * 0.45)
      )
      .force("charge", forceManyBody().strength(getChargeStrength(zoomSpacingRef.current)).distanceMax(320 * zoomSpacingRef.current))
      .force("collide", forceCollide(getCollisionRadius(zoomSpacingRef.current)))
      .force("anchorX", forceX((d) => (anchors.get(d.skill.category) ?? { x: WEB_CX }).x).strength(0.055))
      .force("anchorY", forceY((d) => (anchors.get(d.skill.category) ?? { y: WEB_CY }).y).strength(0.075))
      .on("tick", () => {
        for (const node of nodes) cache.set(node.id, { x: node.x, y: node.y });
        setTick((value) => (value + 1) % 1e9);
      });

    // Restore pins that survived the filter change.
    for (const node of nodes) {
      if (pinnedIds.has(node.id)) {
        node.fx = node.x;
        node.fy = node.y;
      }
    }

    if (reducedMotion) {
      sim.stop();
      sim.tick(220);
      for (const node of nodes) cache.set(node.id, { x: node.x, y: node.y });
      setTick((value) => (value + 1) % 1e9);
    } else {
      sim.alpha(0.9).restart();
    }

    simRef.current = sim;
    return () => sim.stop();
    // pinnedIds intentionally omitted: pin toggles set fx/fy directly on the
    // live nodes; rebuilding the simulation for a pin would jolt the layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, edges, anchors, reducedMotion]);

  const svgPoint = useCallback((event) => {
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const mapped = point.matrixTransform(svg.getScreenCTM().inverse());
    const view = viewRef.current;
    return { x: (mapped.x - view.tx) / view.k, y: (mapped.y - view.ty) / view.k };
  }, []);

  const handleBackgroundDown = useCallback((event) => {
    dragRef.current = { kind: "pan", x: event.clientX, y: event.clientY };
    movedRef.current = false;
  }, []);

  const handleNodeDown = useCallback(
    (event, node) => {
      event.stopPropagation();
      const point = svgPoint(event);
      dragRef.current = { kind: "node", node, dx: node.x - point.x, dy: node.y - point.y };
      movedRef.current = false;
      node.fx = node.x;
      node.fy = node.y;
    },
    [svgPoint]
  );

  useEffect(() => {
    const handleMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === "pan") {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        drag.x = event.clientX;
        drag.y = event.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) movedRef.current = true;
        const svg = svgRef.current;
        const scale = svg ? WEB_VIEW_W / svg.getBoundingClientRect().width : 1;
        viewRef.current.tx += dx * scale;
        viewRef.current.ty += dy * scale;
        setTick((value) => (value + 1) % 1e9);
        return;
      }

      movedRef.current = true;
      const point = svgPoint(event);
      drag.node.fx = point.x + drag.dx;
      drag.node.fy = point.y + drag.dy;
      simRef.current?.alphaTarget(0.25).restart();
    };

    const handleUp = () => {
      const drag = dragRef.current;
      if (drag?.kind === "node") {
        simRef.current?.alphaTarget(0);
        if (!pinnedIds.has(drag.node.id)) {
          drag.node.fx = null;
          drag.node.fy = null;
        }
      }
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [pinnedIds, svgPoint]);

  // Wheel zoom around the viewport centre.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event) => {
      event.preventDefault();
      const view = viewRef.current;
      const next = clamp(view.k * (event.deltaY > 0 ? 0.92 : 1.085), MIN_ZOOM, MAX_ZOOM);
      const cx = (WEB_CX - view.tx) / view.k;
      const cy = (WEB_CY - view.ty) / view.k;
      view.k = next;
      view.tx = WEB_CX - cx * next;
      view.ty = WEB_CY - cy * next;
      applyZoomSpacing(next);
      setTick((value) => (value + 1) % 1e9);
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [applyZoomSpacing]);

  const centerOn = useCallback((x, y) => {
    const view = viewRef.current;
    view.tx = WEB_CX - x * view.k;
    view.ty = WEB_CY - y * view.k;
    setTick((value) => (value + 1) % 1e9);
  }, []);

  // Selecting a skill (or "Center in sphere") pans the web to it.
  useEffect(() => {
    if (!selectedSkill) return;
    const pos = posCacheRef.current.get(selectedSkill.id);
    if (pos) centerOn(pos.x, pos.y);
  }, [selectedSkill?.id, focusNonce, centerOn]);

  // Selection = discharge: arcs leap from the selected node to its companions.
  useEffect(() => {
    if (!selectedSkill || reducedMotion) return;
    const born = performance.now();
    const arcs = relatedSkills.slice(0, 6).map(({ skill }, index) => ({
      fromId: selectedSkill.id,
      toId: skill.id,
      born: born + index * 45,
      rgb: hexToRgb(getSourceAccent(skill.source))
    }));
    strikesRef.current.push(...arcs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkill?.id]);

  // Mission = lightning: strikes from the sky hit every matching skill.
  // Keyed on membership so keystrokes that keep the same matches don't
  // restrike.
  useEffect(() => {
    if (reducedMotion) return;
    const key = highlightIds ? [...highlightIds].sort().join("|") : "";
    if (key === lastStrikeKeyRef.current) return;
    lastStrikeKeyRef.current = key;
    if (!highlightIds) return;
    const born = performance.now();
    [...highlightIds].slice(0, 8).forEach((id, index) => {
      strikesRef.current.push({ fromId: null, toId: id, born: born + index * 70, rgb: hexToRgb("#8cf4ff") });
    });
  }, [highlightIds, reducedMotion]);

  // Plasma paint loop: reads simulation refs directly; canvas alignment with
  // the SVG viewport is derived from the live screen CTM every frame, so
  // pan/zoom/resize stay pixel-exact.
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
      const view = viewRef.current;
      const time = state.reduced ? 0 : performance.now() / 1000;
      const scale = matrix.a * view.k * dpr;
      const toCanvas = (wx, wy) => {
        const vx = wx * view.k + view.tx;
        const vy = wy * view.k + view.ty;
        return [
          (matrix.a * vx + matrix.c * vy + matrix.e - rect.left) * dpr,
          (matrix.b * vx + matrix.d * vy + matrix.f - rect.top) * dpr
        ];
      };

      ctx.globalCompositeOperation = "lighter";

      // Filaments: brightness = relationship strength + endpoint heat.
      for (const link of linksRef.current) {
        const source = link.source;
        const target = link.target;
        if (typeof source !== "object" || typeof target !== "object") continue;
        const [ax, ay] = toCanvas(source.x, source.y);
        const [bx, by] = toCanvas(target.x, target.y);
        const dimmed =
          state.highlightIds && !(state.highlightIds.has(source.id) && state.highlightIds.has(target.id));
        const energized =
          state.selectedId && (source.id === state.selectedId || target.id === state.selectedId);
        const heat = Math.max(
          getActivityFor(state.activity, source.id).heat,
          getActivityFor(state.activity, target.id).heat
        );
        const rgb = hexToRgb(getSourceAccent(source.skill.source));
        // With the straight SVG lines retired, these filaments are the only
        // link rendering — keep them clearly legible.
        let alpha = (0.06 + link.strength * 0.1 + heat * 0.1) * (dimmed ? 0.12 : 1);
        if (energized) alpha = Math.max(alpha, 0.36);
        drawFilament(ctx, ax, ay, bx, by, {
          rgb,
          alpha,
          amp: (2.2 + link.strength * 5.5) * scale,
          phase: hashString(link.id) % 97,
          time,
          jitter: energized && !state.reduced ? 5 * scale : 0,
          width: (energized ? 1.4 : 0.9) * scale
        });
      }

      // Node glows: heat = real invocations x recency. Cold stays cold.
      for (const node of nodesRef.current) {
        const { heat } = getActivityFor(state.activity, node.id);
        const isSelected = node.id === state.selectedId;
        if (heat <= 0 && !isSelected) continue;
        const [x, y] = toCanvas(node.x, node.y);
        const dimmedNode = state.highlightIds && !state.highlightIds.has(node.id) && !isSelected;
        const rgb = hexToRgb(getSourceAccent(node.skill.source));
        const pulse = state.reduced ? 1 : 1 + Math.sin(time * 1.6 + node.id.length + node.x * 0.01) * 0.08;
        let radius = (7 + heat * 26) * scale * pulse;
        let alpha = (0.05 + heat * 0.34) * (dimmedNode ? 0.12 : 1);
        if (isSelected) {
          radius = Math.max(radius, 24 * scale);
          alpha = Math.max(alpha, 0.28);
        }
        drawGlow(ctx, x, y, radius, rgb, alpha);
        if (heat > 0.55 && !dimmedNode) drawGlow(ctx, x, y, radius * 0.38, "255,255,255", alpha * 0.5);
      }

      // Strikes: activation events.
      if (strikesRef.current.length) {
        const now = performance.now();
        strikesRef.current = strikesRef.current.filter((strike) => {
          const target = posCacheRef.current.get(strike.toId);
          if (!target) return false;
          const [bx, by] = toCanvas(target.x, target.y);
          let ax;
          let ay;
          if (strike.fromId) {
            const origin = posCacheRef.current.get(strike.fromId);
            if (!origin) return false;
            [ax, ay] = toCanvas(origin.x, origin.y);
          } else {
            ax = bx + (bx > width / 2 ? -1 : 1) * width * 0.08;
            ay = -12;
          }
          return drawStrike(ctx, ax, ay, bx, by, strike.rgb, now - strike.born, scale);
        });
      }
    };

    raf = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const togglePin = useCallback((node) => {
    setPinnedIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
        node.fx = null;
        node.fy = null;
      } else {
        next.add(node.id);
        node.fx = node.x;
        node.fy = node.y;
      }
      return next;
    });
  }, []);

  const zoomBy = (direction) => {
    const view = viewRef.current;
    const next = clamp(view.k * (direction > 0 ? 1.18 : 0.85), MIN_ZOOM, MAX_ZOOM);
    const cx = (WEB_CX - view.tx) / view.k;
    const cy = (WEB_CY - view.ty) / view.k;
    view.k = next;
    view.tx = WEB_CX - cx * next;
    view.ty = WEB_CY - cy * next;
    applyZoomSpacing(next);
    setTick((value) => (value + 1) % 1e9);
  };

  const reheat = () => simRef.current?.alpha(0.7).restart();

  const resetView = () => {
    viewRef.current = { tx: 0, ty: 0, k: 1 };
    applyZoomSpacing(1);
    setPinnedIds(new Set());
    for (const node of nodesRef.current) {
      node.fx = null;
      node.fy = null;
    }
    reheat();
  };

  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => {
        const seed = hashString(`star-${index}`);
        return {
          x: seed % WEB_VIEW_W,
          y: (seed >> 7) % WEB_VIEW_H,
          r: 0.4 + ((seed >> 3) % 10) / 9,
          o: 0.05 + ((seed >> 5) % 22) / 100
        };
      }),
    []
  );

  const nodes = nodesRef.current;
  const links = linksRef.current;
  const view = viewRef.current;
  const detailScale = view.k > 1 ? 1 / view.k : 1;
  const sourceLegend = sourceLegendFor(skills);

  // Cluster labels sit at the live centroid of each category.
  const centroids = new Map();
  for (const node of nodes) {
    const entry = centroids.get(node.skill.category) ?? { x: 0, y: 0, n: 0 };
    entry.x += node.x;
    entry.y += node.y;
    entry.n += 1;
    centroids.set(node.skill.category, entry);
  }
  const clusterLabels = [];
  for (const [category, { x, y, n }] of centroids) {
    if (n < 2) continue;
    clusterLabels.push({ category, x: x / n, y: y / n - 26 - Math.sqrt(n) * 6, count: n });
  }

  // Label budget: selected, hovered, pinned, mission matches, then hubs.
  const labelIds = new Set();
  if (selectedSkill) labelIds.add(selectedSkill.id);
  if (hoveredId) labelIds.add(hoveredId);
  for (const id of pinnedIds) labelIds.add(id);
  if (highlightIds) for (const id of highlightIds) labelIds.add(id);
  const budget = skills.length <= 14 ? skills.length : view.k > 1.3 ? 14 : 7;
  const hubs = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
  for (const node of hubs) {
    if (labelIds.size >= budget + 2) break;
    labelIds.add(node.id);
  }

  return (
    <>
      <canvas ref={canvasRef} className="plasma-canvas" aria-hidden="true" />
      <svg
        ref={svgRef}
        className="sphere-graph force-graph"
        viewBox={`0 0 ${WEB_VIEW_W} ${WEB_VIEW_H}`}
        role="img"
        aria-label="Force-directed skill web"
        onPointerDown={handleBackgroundDown}
      >
        <g className="starfield" aria-hidden="true">
          {stars.map((star, index) => (
            <circle key={index} cx={star.x} cy={star.y} r={star.r} opacity={star.o} />
          ))}
        </g>

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* Straight SVG edges only as fallback when plasma is toggled off —
              with plasma on, links live on the canvas as filaments. */}
          {!plasmaOn ? (
            <g className="edge-field">
              {links.map((link) => {
                const source = typeof link.source === "object" ? link.source : null;
                const target = typeof link.target === "object" ? link.target : null;
                if (!source || !target) return null;
                const touchesSelected =
                  selectedSkill && (source.id === selectedSkill.id || target.id === selectedSkill.id);
                const dimmed =
                  highlightIds && !(highlightIds.has(source.id) && highlightIds.has(target.id));
                return (
                  <line
                    key={link.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    className={touchesSelected ? "edge-related" : "edge-mesh"}
                    strokeOpacity={(touchesSelected ? 0.85 : 0.16 + link.strength * 0.18) * (dimmed ? 0.2 : 1)}
                    strokeWidth={touchesSelected ? 1.3 : 0.8}
                  >
                    <title>{link.reason}</title>
                  </line>
                );
              })}
            </g>
          ) : null}

          <g className="cluster-labels" aria-hidden="true">
            {clusterLabels.map((label) => (
              <text
                key={label.category}
                className="cluster-label"
                transform={`translate(${label.x} ${label.y}) scale(${detailScale})`}
                x={0}
                y={0}
                style={{ fill: CATEGORY_COLORS[label.category] ?? "#b8ccd3", opacity: 0.8 }}
              >
                {label.category}
                <tspan className="cluster-count"> · {label.count}</tspan>
              </text>
            ))}
          </g>

          <g>
            {nodes.map((node) => {
              const { skill } = node;
              const isSelected = selectedSkill?.id === skill.id;
              const isRelated = relatedMap.has(skill.id);
              const isPinned = pinnedIds.has(skill.id);
              const isHovered = hoveredId === skill.id;
              const relationship = relatedMap.get(skill.id);
              const skillActivity = getActivityFor(activity, skill.id);
              const Icon = CATEGORY_ICONS[skill.category] ?? Wrench;
              const baseR = isSelected ? 10.5 : skill.source === "Personal" ? 6.4 : skill.source === "System" ? 5.8 : 4.8;
              const r = baseR + skillActivity.heat * 2.2;
              const iconSize = Math.max(11, Math.min(18, r * 2));
              const labelVisible = labelIds.has(skill.id);
              const dimmed = highlightIds && !highlightIds.has(skill.id) && !isSelected;

              return (
                <g
                  key={skill.id}
                  className={`graph-node source-${sourceClassName(skill.source)} ${isSelected ? "selected" : ""} ${
                    isRelated ? "related" : ""
                  } ${isPinned ? "pinned" : ""}`}
                  transform={`translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})`}
                  style={{ "--node-accent": getSourceAccent(skill.source), opacity: dimmed ? 0.16 : 1 }}
                  role="button"
                  tabIndex="0"
                  aria-label={`Select ${skill.qualifiedName}`}
                  onPointerDown={(event) => handleNodeDown(event, node)}
                  onClick={() => {
                    if (!movedRef.current) selectSkill(skill.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    togglePin(node);
                  }}
                  onPointerEnter={() => setHoveredId(skill.id)}
                  onPointerLeave={() => setHoveredId((value) => (value === skill.id ? null : value))}
                  onFocus={() => setHoveredId(skill.id)}
                  onBlur={() => setHoveredId((value) => (value === skill.id ? null : value))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") selectSkill(skill.id);
                    if (event.key === "p") togglePin(node);
                  }}
                >
                  <title>
                    {skill.qualifiedName}
                    {relationship ? ` — ${relationship.reasons[0]}` : ` — ${skill.category}`}
                    {skillActivity.sessions
                      ? ` — invoked in ${skillActivity.sessions} session${skillActivity.sessions === 1 ? "" : "s"}`
                      : " — never invoked"}
                    {isPinned ? " (pinned — double-click to release)" : ""}
                  </title>
                  <g transform={`scale(${detailScale})`}>
                  {isSelected ? <circle className="selected-aura" r={r * 3.6} /> : null}
                  <circle className="hit-area" r={Math.max(r + 8, 13)} />
                  {isSelected ? <circle className="selected-ring" r={r + 5.5} /> : null}
                  {isRelated && !isSelected ? <circle className="related-ring" r={r + 3} /> : null}
                  {isPinned ? <circle className="pinned-ring" r={r + 6.5} /> : null}
                  <circle className="node-core" r={r} />
                  <circle className="icon-plate" r={Math.max(r + 4, 11)} />
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
                    <text className="node-label" y={r + 13}>
                      {skill.name}
                    </text>
                  ) : null}
                  {labelVisible && (isSelected || isHovered) ? (
                    <text className="node-sub" y={r + 24}>
                      {skill.category}
                    </text>
                  ) : null}
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="graph-controls" aria-label="Web navigation">
        <button
          type="button"
          onClick={() => {
            const pos = selectedSkill ? posCacheRef.current.get(selectedSkill.id) : null;
            if (pos) centerOn(pos.x, pos.y);
          }}
          title="Center selected skill"
        >
          <Crosshair size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(1)} title="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} title="Zoom out">
          <Minus size={16} />
        </button>
        <button type="button" onClick={reheat} title="Reheat layout">
          <Flame size={15} />
        </button>
        <button
          type="button"
          className={plasmaOn ? "active" : ""}
          onClick={() => setPlasmaOn((value) => !value)}
          title={plasmaOn ? "Plasma off" : "Plasma on"}
        >
          <Zap size={15} />
        </button>
        <button type="button" onClick={resetView} title="Reset view and unpin all">
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
        {pinnedIds.size ? (
          <span>
            <Pin size={10} />
            {pinnedIds.size} pinned
          </span>
        ) : null}
      </div>

      <div className="graph-hint">
        <span>drag node · move</span>
        <span>double-click · pin</span>
        <span>drag space · pan</span>
        <span>scroll · zoom</span>
      </div>
    </>
  );
}

export default ForceGraph;
