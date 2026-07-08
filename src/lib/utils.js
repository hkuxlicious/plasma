export function hashString(input = "") {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function compactNumber(value) {
  return new Intl.NumberFormat("en", { notation: value >= 1000 ? "compact" : "standard" }).format(value);
}

export function formatTokenCount(value = 0) {
  if (value >= 1000000) {
    return `${new Intl.NumberFormat("en", {
      maximumFractionDigits: value >= 10000000 ? 0 : 1
    }).format(value / 1000000)}M`;
  }
  if (value >= 1000) {
    return `${new Intl.NumberFormat("en", {
      maximumFractionDigits: value >= 10000 ? 0 : 1
    }).format(value / 1000)}k`;
  }
  return compactNumber(value);
}

export function formatDate(value) {
  if (!value) return "not generated";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ageDays(value) {
  if (!value) return 999;
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86400000));
}

const QUERY_STOP_WORDS = new Set([
  "a", "an", "and", "about", "as", "at", "be", "by", "can", "do", "for",
  "from", "go", "help", "how", "i", "if", "in", "into", "is", "it", "make",
  "me", "my", "need", "needs", "no", "of", "on", "or", "please", "skill",
  "skills", "so", "some", "that", "the", "then", "them", "this", "to", "up",
  "use", "using", "want", "we", "what", "when", "will", "with", "your"
]);

/**
 * Client-side tokenizer for mission queries and prompt matching. Keeps short
 * domain words ("ui", "pdf", "css") that the generator's stricter tokenizer
 * drops, so task text like "edit pdf" still lands.
 */
export function tokenize(value = "") {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !QUERY_STOP_WORDS.has(word));
}

export function getOrderedOptions(items, key) {
  return Array.from(new Set(items.map((item) => item[key]))).sort((a, b) => a.localeCompare(b));
}

export function matchSkill(skill, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    skill.name,
    skill.displayName,
    skill.qualifiedName,
    skill.description,
    skill.summary,
    skill.whenToUse,
    skill.category,
    skill.plugin,
    skill.source,
    ...(skill.secondaryCategories ?? []),
    ...(skill.tags ?? [])
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}
