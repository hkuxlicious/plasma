import { clamp, hashString } from "./utils.js";

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const DEFAULT_CAM = 3.1;
export const SPHERE_RADIUS_PX = 232;
export const VIEW_CX = 450;
export const VIEW_CY = 298;

export function shortestAngle(delta) {
  let angle = delta % (Math.PI * 2);
  if (angle > Math.PI) angle -= Math.PI * 2;
  if (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function normalizeVec(v) {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function rotateVec(v, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = v.x * cy - v.z * sy;
  const z1 = v.x * sy + v.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return { x: x1, y: v.y * cp - z1 * sp, z: v.y * sp + z1 * cp };
}

export function vectorToRotation(v) {
  return {
    yaw: Math.atan2(v.x, v.z),
    pitch: Math.atan2(v.y, Math.hypot(v.x, v.z))
  };
}

export function dotVec(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function fibonacciDirections(count) {
  return Array.from({ length: count }, (_, index) => {
    const y = count === 1 ? 0 : 1 - (2 * (index + 0.5)) / count;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = index * GOLDEN_ANGLE;
    return { x: radius * Math.cos(phi), y, z: radius * Math.sin(phi) };
  });
}

export function tangentBasis(center) {
  const reference = Math.abs(center.y) > 0.92 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const u = normalizeVec({
    x: center.y * reference.z - center.z * reference.y,
    y: center.z * reference.x - center.x * reference.z,
    z: center.x * reference.y - center.y * reference.x
  });
  const w = {
    x: center.y * u.z - center.z * u.y,
    y: center.z * u.x - center.x * u.z,
    z: center.x * u.y - center.y * u.x
  };
  return [u, w];
}

export function capPoint(center, basis, theta, phi) {
  const [u, w] = basis;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const tx = Math.cos(phi);
  const ty = Math.sin(phi);
  return normalizeVec({
    x: center.x * cos + (u.x * tx + w.x * ty) * sin,
    y: center.y * cos + (u.y * tx + w.y * ty) * sin,
    z: center.z * cos + (u.z * tx + w.z * ty) * sin
  });
}

function bandPositions(skills, yTop, yBottom) {
  const map = new Map();
  skills.forEach((skill, index) => {
    const fraction = skills.length === 1 ? 0.5 : (index + 0.5) / skills.length;
    const y = yTop + (yBottom - yTop) * fraction;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = index * GOLDEN_ANGLE + (hashString(skill.id) % 17) * 0.05;
    map.set(skill.id, { x: radius * Math.cos(phi), y, z: radius * Math.sin(phi) });
  });
  return map;
}

/**
 * Shared cluster layout: one spherical cap per group, sized by member count.
 * Used by both the category lens and the plugin lens. Returns node vectors
 * plus a label anchor per cluster so the graph can name its regions.
 */
function capClusters(groups) {
  const map = new Map();
  const anchors = [];
  const centers = fibonacciDirections(groups.length);

  groups.forEach(({ key, members }, groupIndex) => {
    const center = centers[groupIndex];
    const basis = tangentBasis(center);
    const capRadius = clamp(0.24 + Math.sqrt(members.length) * 0.1, 0.3, 0.92);
    const spin = ((hashString(key) % 100) / 100) * Math.PI * 2;
    const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((skill, index) => {
      const t = sorted.length === 1 ? 0 : Math.sqrt((index + 0.5) / sorted.length);
      map.set(skill.id, capPoint(center, basis, t * capRadius, index * GOLDEN_ANGLE + spin));
    });
    anchors.push({ key, count: members.length, vec: center });
  });

  return { map, anchors };
}

function groupBy(skills, key) {
  const groups = new Map();
  for (const skill of skills) {
    const value = skill[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(skill);
  }
  return [...groups.entries()]
    .map(([groupKey, members]) => ({ key: groupKey, members }))
    .sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));
}

const SOURCE_PRIORITY = { Personal: 0, System: 1, Plugin: 2 };

function groupBySource(skills) {
  return groupBy(skills, "source")
    .sort((a, b) => (SOURCE_PRIORITY[a.key] ?? 10) - (SOURCE_PRIORITY[b.key] ?? 10) || a.key.localeCompare(b.key));
}

/**
 * Every skill gets a fixed unit vector on the sphere for the active lens.
 * Returns { map, anchors } — anchors are cluster label positions (empty for
 * lenses without named regions).
 */
export function computeBaseVectors(skills, mode, selectedSkill, relatedMap, unseenIds) {
  if (mode === "focus" && selectedSkill && skills.some((skill) => skill.id === selectedSkill.id)) {
    const map = new Map();
    map.set(selectedSkill.id, { x: 0, y: 0, z: 1 });
    const relatedIds = [];
    for (const [id, item] of relatedMap) relatedIds.push({ id, rank: item.rank });
    relatedIds.sort((a, b) => a.rank - b.rank);
    relatedIds.forEach(({ id }, index) => {
      if (!skills.some((skill) => skill.id === id)) return;
      const ring = Math.floor(index / 7);
      const theta = 0.52 + ring * 0.4;
      const phi = ((index % 7) / 7) * Math.PI * 2 + ring * 0.6;
      map.set(
        id,
        normalizeVec({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.sin(theta) * Math.sin(phi),
          z: Math.cos(theta)
        })
      );
    });
    const others = skills.filter((skill) => !map.has(skill.id));
    others.forEach((skill, index) => {
      const z = -(0.2 + 0.75 * ((index + 0.5) / Math.max(others.length, 1)));
      const radius = Math.sqrt(Math.max(0, 1 - z * z));
      const phi = index * GOLDEN_ANGLE;
      map.set(skill.id, { x: radius * Math.cos(phi), y: radius * Math.sin(phi), z });
    });
    return { map, anchors: [] };
  }

  if (mode === "source") {
    const map = new Map();
    const groups = groupBySource(skills);
    const top = 0.96;
    const bottom = -0.97;
    const gap = 0.035;
    const bandHeight = groups.length ? (top - bottom - gap * Math.max(0, groups.length - 1)) / groups.length : 0;
    const anchors = [];
    groups.forEach((group, index) => {
      const bandTop = top - index * (bandHeight + gap);
      const bandBottom = bandTop - bandHeight;
      for (const [id, vec] of bandPositions(group.members, bandTop, bandBottom)) map.set(id, vec);
      const midY = (bandTop + bandBottom) / 2;
      anchors.push({
        key: group.key,
        count: group.members.length,
        vec: normalizeVec({ x: 0, y: midY, z: Math.sqrt(Math.max(0.05, 1 - midY * midY)) })
      });
    });
    return { map, anchors };
  }

  if (mode === "forgotten") {
    const map = new Map();
    const unseen = skills.filter((skill) => unseenIds.has(skill.id));
    const seen = skills.filter((skill) => !unseenIds.has(skill.id));
    unseen.forEach((skill, index) => {
      const z = 0.16 + 0.78 * ((index + 0.5) / Math.max(unseen.length, 1));
      const radius = Math.sqrt(Math.max(0, 1 - z * z));
      const phi = index * GOLDEN_ANGLE;
      map.set(skill.id, { x: radius * Math.cos(phi), y: radius * Math.sin(phi), z });
    });
    seen.forEach((skill, index) => {
      const z = -(0.14 + 0.8 * ((index + 0.5) / Math.max(seen.length, 1)));
      const radius = Math.sqrt(Math.max(0, 1 - z * z));
      const phi = index * GOLDEN_ANGLE;
      map.set(skill.id, { x: radius * Math.cos(phi), y: radius * Math.sin(phi), z });
    });
    return { map, anchors: [] };
  }

  if (mode === "plugin") {
    return capClusters(groupBy(skills, "plugin"));
  }

  // Category lens (default "sphere" mode).
  return capClusters(groupBy(skills, "category"));
}

export function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Edges: strong explainable spokes from the selected skill, plus a sparse
 * nearest-neighbour mesh inside each cluster so groups read as webs.
 * The mesh follows the active lens: categories on the sphere lens,
 * plugins on the plugin lens.
 */
export function buildSphereEdges(skills, baseVectors, selectedSkill, relatedSkills, meshKey = "category") {
  const edges = [];
  const seen = new Set();
  const inSet = new Set(skills.map((skill) => skill.id));

  if (selectedSkill && inSet.has(selectedSkill.id)) {
    relatedSkills.slice(0, 12).forEach(({ skill, reasons, score }) => {
      if (!inSet.has(skill.id)) return;
      seen.add(edgeKey(selectedSkill.id, skill.id));
      edges.push({
        id: `rel-${skill.id}`,
        a: selectedSkill.id,
        b: skill.id,
        kind: "related",
        strength: Math.min(1, score / 100),
        reason: reasons[0] ?? "Related skill"
      });
    });
  }

  const byGroup = new Map();
  for (const skill of skills) {
    const group = skill[meshKey];
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(skill);
  }

  for (const [group, members] of byGroup) {
    for (const skill of members) {
      const vec = baseVectors.get(skill.id);
      if (!vec) continue;
      const neighbours = members
        .filter((other) => other.id !== skill.id && baseVectors.has(other.id))
        .map((other) => ({ other, dot: dotVec(vec, baseVectors.get(other.id)) }))
        .sort((a, b) => b.dot - a.dot)
        .slice(0, 2);
      for (const { other } of neighbours) {
        const key = edgeKey(skill.id, other.id);
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
          id: `mesh-${key}`,
          a: skill.id,
          b: other.id,
          kind: "mesh",
          strength: 0.35,
          reason: meshKey === "plugin" ? `Both come from the ${group} plugin` : `Both are ${group} skills`
        });
      }
    }
  }

  return edges;
}

export function ringAround(axis, segments = 64) {
  const normal = normalizeVec(axis);
  const [u, w] = tangentBasis(normal);
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = (index / segments) * Math.PI * 2;
    return normalizeVec({
      x: u.x * Math.cos(t) + w.x * Math.sin(t),
      y: u.y * Math.cos(t) + w.y * Math.sin(t),
      z: u.z * Math.cos(t) + w.z * Math.sin(t)
    });
  });
}

export const SHELL_RINGS = [
  ringAround({ x: 0, y: 1, z: 0 }),
  ringAround({ x: 1, y: 0.4, z: 0 }),
  ringAround({ x: -0.45, y: 0.62, z: 0.64 })
];

export function ringPath(points, rot, camDist, radius, frontSide) {
  let d = "";
  let pen = false;
  for (const point of points) {
    const v = rotateVec(point, rot.yaw, rot.pitch);
    if (v.z >= 0 !== frontSide) {
      pen = false;
      continue;
    }
    const persp = camDist / (camDist - v.z * 0.96);
    const x = (VIEW_CX + v.x * radius * persp).toFixed(1);
    const y = (VIEW_CY - v.y * radius * persp).toFixed(1);
    d += pen ? `L${x} ${y}` : `M${x} ${y}`;
    pen = true;
  }
  return d;
}
