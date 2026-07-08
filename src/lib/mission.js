import { getActivityFor } from "./usage.js";
import { tokenize } from "./utils.js";

/**
 * Task-first matching: score every installed skill against a free-text task
 * description using the activation data the generator already extracted
 * (tokens, whenToUse, real trigger prompts). Pure lexical, fully local.
 */

const ROUTE_STAGES = [
  {
    id: "plan",
    label: "Plan",
    detail: "Frame the work",
    categories: ["Research", "Skill Ops"],
    terms: ["research", "plan", "brief", "strategy", "analyze", "compare", "decide"]
  },
  {
    id: "build",
    label: "Build",
    detail: "Create or change the artifact",
    categories: [
      "AI & Media",
      "Code & Repos",
      "Data & Payments",
      "Documents",
      "Email",
      "Frontend",
      "Games & 3D",
      "Tools"
    ],
    terms: ["build", "create", "design", "redesign", "edit", "write", "implement", "frontend", "landing", "ui"]
  },
  {
    id: "verify",
    label: "Verify",
    detail: "Check quality and risk",
    categories: ["Browser & QA", "Security"],
    terms: ["verify", "test", "qa", "browser", "review", "debug", "fix", "security", "check"]
  },
  {
    id: "ship",
    label: "Ship/Fix",
    detail: "Deploy, debug, or stabilize",
    categories: ["Deploy & Infra", "Security", "Code & Repos"],
    terms: ["deploy", "ship", "production", "logs", "incident", "debug", "fix", "ci", "release"]
  }
];

function normalizeName(name = "") {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function hasAny(queryTokens, terms) {
  return terms.some((term) => queryTokens.includes(term) || queryTokens.some((token) => token.includes(term)));
}

function getCategoryRouteBoost(skill, queryTokens) {
  let boost = 0;

  if (skill.category === "Frontend" && hasAny(queryTokens, ["frontend", "ui", "landing", "screen", "design", "redesign"])) {
    boost += 12;
  }
  if (skill.category === "Browser & QA" && hasAny(queryTokens, ["browser", "verify", "test", "qa", "screenshot", "layout"])) {
    boost += 12;
  }
  if (skill.category === "Deploy & Infra" && hasAny(queryTokens, ["deploy", "ship", "production", "logs", "ci", "domain"])) {
    boost += 10;
  }
  if (skill.category === "Security" && hasAny(queryTokens, ["security", "risk", "review", "vulnerability", "threat"])) {
    boost += 10;
  }
  if (skill.category === "Documents" && hasAny(queryTokens, ["doc", "docs", "pdf", "deck", "document"])) {
    boost += 8;
  }

  return boost;
}

function scoreSkill(skill, text, queryTokens, activity, duplicateNameCount = 1) {
  let score = 0;
  const reasons = [];

  // Real trigger prompts are the strongest signal: they describe the exact
  // tasks the skill was written for.
  let promptHit = null;
  for (const prompt of skill.examplePrompts ?? []) {
    const promptTokens = new Set(tokenize(prompt));
    const hits = queryTokens.filter((token) => promptTokens.has(token)).length;
    if (prompt.toLowerCase().includes(text) || hits >= 2) {
      promptHit = prompt;
      break;
    }
  }
  if (promptHit) {
    score += 14;
    reasons.push(`matches trigger: "${promptHit}"`);
  }

  const name = skill.qualifiedName.toLowerCase();
  const nameTokens = new Set(tokenize(skill.name));
  if (name.includes(text) || queryTokens.some((token) => nameTokens.has(token))) {
    score += 16;
    reasons.push("name match");
  }

  const whenText = (skill.whenToUse ?? "").toLowerCase();
  const whenTokens = new Set(tokenize(whenText));
  const whenHits = queryTokens.filter((token) => whenTokens.has(token));
  if (whenText.includes(text) || whenHits.length >= 2) {
    score += 10;
    reasons.push("fits its when-to-use");
  }

  const skillTokens = new Set(skill.tokens ?? []);
  const shared = queryTokens.filter((token) => skillTokens.has(token));
  if (shared.length) {
    score += Math.min(30, shared.length * 6);
    reasons.push(`shared terms: ${shared.slice(0, 3).join(", ")}`);
  }

  const categoryWords = tokenize(skill.category);
  if (categoryWords.some((word) => text.includes(word))) {
    score += 8;
    reasons.push(`category: ${skill.category}`);
  }

  const tagHits = (skill.tags ?? []).filter((tag) => queryTokens.includes(tag));
  if (tagHits.length) {
    score += Math.min(8, tagHits.length * 4);
    reasons.push(`tags: ${tagHits.slice(0, 2).join(", ")}`);
  }

  const activityRecord = getActivityFor(activity, skill.id);
  const activityBoost = activityRecord.heat * 7 + Math.min(4, activityRecord.sessions / 4);
  const routeBoost = getCategoryRouteBoost(skill, queryTokens);
  const duplicatePenalty = duplicateNameCount > 1 && score < 36 ? 7 : 0;
  const adjustedScore = Math.max(0, score + activityBoost + routeBoost - duplicatePenalty);

  return {
    score,
    adjustedScore,
    confidence: Math.min(99, Math.round(adjustedScore)),
    reason: reasons[0] ?? "metadata similarity",
    reasons,
    usageReason: activityRecord.sessions
      ? `used in ${activityRecord.sessions} local session${activityRecord.sessions === 1 ? "" : "s"}`
      : null,
    duplicatePenalty
  };
}

function stageFit(item, stage, queryTokens) {
  let score = item.adjustedScore;
  const categoryFit = stage.categories.includes(item.skill.category);
  if (categoryFit) score += 24;
  if (item.skill.secondaryCategories?.some((category) => stage.categories.includes(category))) score += 8;
  if (!categoryFit) score -= 18;
  if (hasAny(queryTokens, stage.terms)) score += 8;
  if (stage.id === "ship" && !hasAny(queryTokens, stage.terms) && item.adjustedScore < 32) score -= 18;
  return score;
}

function buildRoute(scored, queryTokens) {
  const pool = scored.slice(0, 18);
  const route = [];
  const used = new Set();

  for (const stage of ROUTE_STAGES) {
    const candidates = pool
      .filter((item) => !used.has(item.skill.id))
      .filter((item) => stage.id === "ship" || stage.categories.includes(item.skill.category))
      .map((item) => ({ ...item, stageFit: stageFit(item, stage, queryTokens) }))
      .sort((a, b) => b.stageFit - a.stageFit || b.adjustedScore - a.adjustedScore);

    const pick = candidates[0];
    if (!pick) continue;
    const categoryFit = stage.categories.includes(pick.skill.category);
    if (stage.id === "ship" && pick.stageFit < 42) continue;
    if (!categoryFit && (stage.id !== "ship" || !hasAny(queryTokens, stage.terms))) continue;

    used.add(pick.skill.id);
    route.push({
      ...pick,
      stageId: stage.id,
      stageLabel: stage.label,
      stageDetail: stage.detail,
      step: route.length + 1
    });
  }

  return route.length >= 2 ? route : [];
}

function buildCopyPrompt(mission, route) {
  if (!route.length) return "";
  const steps = route
    .map((item) => `${item.step}. ${item.stageLabel}: use ${item.skill.qualifiedName} because ${item.reason}.`)
    .join("\n");
  return `Mission: ${mission}\n\nRecommended Plasma route:\n${steps}\n\nFollow this route in order, inspect each skill before use, and verify the final output.`;
}

export function getMissionResults(query, skills, limit = 6, activity = null) {
  const text = query.trim().toLowerCase();
  if (text.length < 3) return { mission: query, results: [], chain: [], route: [], routeConfidence: 0, copyPrompt: "", routeSkillIds: [] };
  const queryTokens = [...new Set(tokenize(text))];
  if (!queryTokens.length) {
    return { mission: query, results: [], chain: [], route: [], routeConfidence: 0, copyPrompt: "", routeSkillIds: [] };
  }

  const duplicateNameCounts = skills.reduce((map, skill) => {
    const key = normalizeName(skill.name);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());

  const scored = [];
  for (const skill of skills) {
    const scores = scoreSkill(skill, text, queryTokens, activity, duplicateNameCounts.get(normalizeName(skill.name)) ?? 1);
    if (scores.adjustedScore > 0) scored.push({ skill, ...scores });
  }
  scored.sort((a, b) => b.adjustedScore - a.adjustedScore || a.skill.qualifiedName.localeCompare(b.skill.qualifiedName));

  const route = buildRoute(scored, queryTokens);
  const routeSkillIds = route.map((item) => item.skill.id);
  const routeConfidence = route.length
    ? Math.min(99, Math.round(route.reduce((sum, item) => sum + item.confidence, 0) / route.length + route.length * 3))
    : 0;

  return {
    mission: query,
    results: scored.slice(0, limit).map((item) => ({
      ...item,
      score: item.confidence
    })),
    chain: route,
    route,
    routeConfidence,
    copyPrompt: buildCopyPrompt(query.trim(), route),
    routeSkillIds
  };
}
