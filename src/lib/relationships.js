import { getActivityFor } from "./usage.js";

/**
 * Token sets are precomputed by the generator (skill.tokens); cache the Set
 * per skill object so repeated scoring never re-tokenizes anything.
 */
const tokenSetCache = new WeakMap();

function getTokenSet(skill) {
  let set = tokenSetCache.get(skill);
  if (!set) {
    set = new Set(skill.tokens ?? []);
    tokenSetCache.set(skill, set);
  }
  return set;
}

export function relationshipBetween(selected, skill) {
  if (!selected || !skill || selected.id === skill.id) return { score: 0, reasons: [] };

  const reasons = [];
  let score = 0;

  if (selected.category === skill.category) {
    score += 42;
    reasons.push(`Both are ${selected.category} skills`);
  }

  // Same-plugin bonus only applies to real plugins. Personal skills all share
  // plugin "user" and system skills share "system" — those are not families.
  if (selected.source === "Plugin" && skill.source === "Plugin" && selected.plugin === skill.plugin) {
    score += 32;
    reasons.push(`Same ${selected.plugin} plugin`);
  }

  const crossDomain =
    selected.secondaryCategories?.includes(skill.category) ||
    skill.secondaryCategories?.includes(selected.category);
  if (crossDomain) {
    score += 18;
    reasons.push(`${skill.category} overlaps ${selected.category === skill.category ? "its own domain" : selected.category}`);
  }

  if (selected.source === skill.source) {
    score += 8;
    reasons.push(`Same ${selected.source.toLowerCase()} source`);
  }

  const sharedTags = selected.tags.filter((tag) => skill.tags.includes(tag) && tag !== selected.plugin);
  if (sharedTags.length) {
    score += Math.min(24, sharedTags.length * 8);
    reasons.push(`Shared tags: ${sharedTags.slice(0, 3).join(", ")}`);
  }

  const skillTokens = getTokenSet(skill);
  const sharedTerms = (selected.tokens ?? []).filter((token) => skillTokens.has(token)).slice(0, 4);
  if (sharedTerms.length) {
    score += Math.min(28, sharedTerms.length * 7);
    reasons.push(`Shared language: ${sharedTerms.join(", ")}`);
  }

  if (!reasons.length && score > 0) reasons.push("Weak metadata similarity");
  return { score, reasons };
}

export function getRelatedSkills(allSkills, selectedSkill, limit = 8) {
  if (!selectedSkill) return [];
  return allSkills
    .map((skill) => ({ skill, ...relationshipBetween(selectedSkill, skill) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.qualifiedName.localeCompare(b.skill.qualifiedName))
    .slice(0, limit);
}

export function getGroupStats(skills, key, colorMap = {}, fallbackColor = "#b8ccd3") {
  const counts = skills.reduce((acc, skill) => {
    acc[skill[key]] = (acc[skill[key]] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([group, count]) => ({ group, count, color: colorMap[group] ?? fallbackColor }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

export function getCategoryStats(skills, colorMap) {
  return getGroupStats(skills, "category", colorMap).map(({ group, count, color }) => ({
    category: group,
    count,
    color
  }));
}

export function getOpportunities(allSkills, activity, categoryStats) {
  const neverInvoked = allSkills.filter((skill) => getActivityFor(activity, skill.id).sessions === 0).length;
  const topCategory = categoryStats[0];
  const thinCategory = [...categoryStats].reverse().find((item) => item.count <= 3);
  const personalCold = allSkills.filter(
    (skill) => skill.source === "Personal" && getActivityFor(activity, skill.id).sessions === 0
  ).length;
  const weakSkills = allSkills.filter((skill) => (skill.completeness ?? 0) < 60);
  const weakMetadata = weakSkills.length;
  const weakestSkill = [...weakSkills].sort((a, b) => (a.completeness ?? 0) - (b.completeness ?? 0))[0];

  return [
    {
      label: "Cold Shelf",
      detail: `${neverInvoked} unused skills have never appeared in local sessions. Bring them forward.`,
      action: { mode: "forgotten" }
    },
    {
      label: "Dense Constellation",
      detail: topCategory
        ? `${topCategory.category} holds ${topCategory.count} skills. Rotate into that cluster.`
        : "No category data yet.",
      action: topCategory ? { category: topCategory.category } : {}
    },
    {
      label: "Personal Skill Audit",
      detail: personalCold
        ? `${personalCold} personal skills have no local session usage yet. Worth a pass.`
        : "Every personal skill has real usage. Nice.",
      action: { source: "Personal" }
    },
    {
      label: "Weak Metadata",
      detail: weakMetadata
        ? `${weakMetadata} skills have thin SKILL.md files. Worth documenting better.`
        : thinCategory
          ? `${thinCategory.category} only has ${thinCategory.count} skill${thinCategory.count === 1 ? "" : "s"}. Worth merging or growing.`
          : "Metadata looks healthy across the library.",
      action: weakestSkill ? { skillId: weakestSkill.id } : thinCategory ? { category: thinCategory.category } : {}
    }
  ];
}
