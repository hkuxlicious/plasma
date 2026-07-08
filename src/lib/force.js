import { relationshipBetween } from "./relationships.js";
import { hashString } from "./utils.js";

export const WEB_VIEW_W = 900;
export const WEB_VIEW_H = 600;
export const WEB_CX = WEB_VIEW_W / 2;
export const WEB_CY = WEB_VIEW_H / 2;

/**
 * Web edges: every skill links to its top-2 strongest relationships, so each
 * line in the graph carries a human-readable reason. O(n^2) scoring runs once
 * per visible-skill set and is memoized by the caller.
 */
export function buildWebEdges(skills, perNode = 2) {
  const edges = [];
  const seen = new Set();

  for (const skill of skills) {
    const best = [];
    for (const other of skills) {
      if (other.id === skill.id) continue;
      const { score, reasons } = relationshipBetween(skill, other);
      if (score <= 0) continue;
      best.push({ other, score, reason: reasons[0] ?? "Related skill" });
    }
    best.sort((a, b) => b.score - a.score || a.other.qualifiedName.localeCompare(b.other.qualifiedName));

    for (const { other, score, reason } of best.slice(0, perNode)) {
      const key = skill.id < other.id ? `${skill.id}|${other.id}` : `${other.id}|${skill.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        id: `web-${key}`,
        a: skill.id,
        b: other.id,
        score,
        strength: Math.min(1, score / 100),
        reason
      });
    }
  }

  return edges;
}

/**
 * Category anchor points on an ellipse around the viewport centre. Weak
 * forceX/forceY pulls toward these keep clusters spatially grouped and
 * legible without caging the simulation.
 */
export function categoryAnchors(categories) {
  const anchors = new Map();
  const sorted = [...categories].sort((a, b) => a.localeCompare(b));
  sorted.forEach((category, index) => {
    const angle = (index / Math.max(sorted.length, 1)) * Math.PI * 2 - Math.PI / 2;
    anchors.set(category, {
      x: WEB_CX + Math.cos(angle) * 250,
      y: WEB_CY + Math.sin(angle) * 165
    });
  });
  return anchors;
}

/** Deterministic initial position near the category anchor. */
export function seedPosition(skill, anchors) {
  const anchor = anchors.get(skill.category) ?? { x: WEB_CX, y: WEB_CY };
  const seed = hashString(skill.id);
  return {
    x: anchor.x + (((seed % 41) - 20) / 20) * 60,
    y: anchor.y + ((((seed >> 6) % 41) - 20) / 20) * 60
  };
}
