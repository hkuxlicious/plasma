/**
 * Overlap advisor: find skill pairs that likely compete for the same
 * triggers. Two signals, tuned against the real library:
 *
 * - Same normalized name across different sources/plugins → likely duplicate
 *   (e.g. personal `pdf` vs plugin `pdf:pdf`, `shadcn` shipped by two plugins).
 * - High overlap coefficient between generator token sets
 *   (|intersection| / |smaller set|) → overlapping scope even with different
 *   names (e.g. stripe-best-practices vs vercel:payments at 0.53).
 *
 * Same-plugin siblings are skipped — a plugin's own skill family shares
 * vocabulary by design (codex-security's scan suite), that is not a conflict.
 */
export function findOverlaps(skills, { threshold = 0.4, limit = 5 } = {}) {
  const norm = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const sets = new Map(skills.map((skill) => [skill.id, new Set(skill.tokens ?? [])]));
  const pairs = [];

  for (let i = 0; i < skills.length; i += 1) {
    for (let j = i + 1; j < skills.length; j += 1) {
      const a = skills[i];
      const b = skills[j];
      const sameName = norm(a.name) === norm(b.name);
      if (!sameName && a.plugin === b.plugin && a.source === b.source) continue;

      const setA = sets.get(a.id);
      const setB = sets.get(b.id);
      let intersection = 0;
      const shared = [];
      for (const token of setA) {
        if (setB.has(token)) {
          intersection += 1;
          if (shared.length < 4) shared.push(token);
        }
      }
      const coefficient = intersection / Math.max(1, Math.min(setA.size, setB.size));
      if (!sameName && coefficient < threshold) continue;

      pairs.push({
        a,
        b,
        sameName,
        coefficient,
        shared,
        score: sameName ? 60 + coefficient * 40 : coefficient * 100,
        verdict: sameName ? "Likely duplicates" : "Overlapping scope"
      });
    }
  }

  return pairs.sort((x, y) => y.score - x.score).slice(0, limit);
}
