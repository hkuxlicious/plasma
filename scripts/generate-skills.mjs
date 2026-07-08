import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const workspaceRoot = process.cwd();
const generatedDataRoot = path.join(workspaceRoot, "src", "data", "generated");
const outputPath = path.join(generatedDataRoot, "skills.generated.json");
const codexRoot = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const localSkillsRoot = path.join(codexRoot, "skills");
const systemSkillsRoot = path.join(localSkillsRoot, ".system");
const pluginCacheRoot = path.join(codexRoot, "plugins", "cache");

function slugLabel(value) {
  return String(value || "agent")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "agent";
}

function displayLabel(value) {
  return String(value || "Agent")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Agent";
}

function parseAgentRootEntry(entry, index) {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const separator = trimmed.indexOf("=");
  const rawLabel = separator > 0 ? trimmed.slice(0, separator).trim() : "";
  const rawRoot = separator > 0 ? trimmed.slice(separator + 1).trim() : trimmed;
  if (!rawRoot) return null;
  const root = path.resolve(rawRoot.replace(/^["']|["']$/g, ""));
  const label = displayLabel(rawLabel || path.basename(root) || `Agent ${index + 1}`);

  return {
    kind: "agent",
    root,
    source: label,
    agent: label,
    channel: "custom",
    plugin: slugLabel(label),
    version: "local"
  };
}

function getConfiguredAgentRoots() {
  const raw = process.env.PLASMA_AGENT_SKILL_ROOTS || process.env.PLASMA_SKILL_ROOTS || "";
  return raw
    .split(/\r?\n/)
    .flatMap((line) => line.split(path.delimiter))
    .map(parseAgentRootEntry)
    .filter(Boolean);
}

const sourceRoots = [
  {
    kind: "personal",
    root: localSkillsRoot,
    source: "Personal",
    agent: "Codex",
    channel: "local",
    plugin: "user",
    version: "local",
    exclude: [systemSkillsRoot]
  },
  {
    kind: "system",
    root: systemSkillsRoot,
    source: "System",
    agent: "Codex",
    channel: "core",
    plugin: "system",
    version: "local"
  },
  {
    kind: "plugin",
    root: pluginCacheRoot,
    source: "Plugin",
    agent: "Codex"
  },
  ...getConfiguredAgentRoots()
];

/* ---------------------------------------------------------------------------
 * Topical categories, scored instead of first-match.
 *
 * Categories describe what a skill is FOR. The provider axis (which plugin it
 * came from) already lives in `plugin`/`source`, so plugins are never
 * categories. Every keyword match in the skill name scores 4, in the plugin
 * name 3, in the description 1. Plugin hints add 5 for plugins whose skills
 * are all one topic. Highest score wins; earlier entries win ties, so the
 * more specific topics sit above the broad ones.
 * ------------------------------------------------------------------------- */

const CATEGORY_RULES = [
  {
    name: "Security",
    keywords: [/secur/i, /vulnerab/i, /\bthreat/i, /exploit/i, /attack/i, /\bfindings?\b/i, /firewall|\bwaf\b/i, /pentest/i, /\bcve\b/i],
    pluginHints: ["codex-security"]
  },
  {
    name: "Games & 3D",
    keywords: [/\bgame/i, /phaser/i, /three\.?js|webgl|\br3f\b|react-three/i, /sprite/i, /\b3d\b/i, /gameplay/i, /playtest/i],
    pluginHints: ["game-studio"]
  },
  {
    name: "Email",
    keywords: [/gmail/i, /\bemail/i, /inbox/i, /\bmail(?:box)?\b/i, /\bthreads?\b/i],
    pluginHints: ["gmail"]
  },
  {
    name: "Documents",
    keywords: [/document/i, /\bdocx?\b/i, /\bpdf\b/i, /spreadsheet|xlsx|\bcsv\b|excel/i, /slides|presentation|powerpoint|pptx/i, /template/i],
    pluginHints: ["documents", "pdf", "presentations", "spreadsheets", "template-creator"]
  },
  {
    name: "Code & Repos",
    keywords: [/github/i, /\bgit\b/i, /pull request/i, /\bissues?\b/i, /\bci\b/i, /commit/i, /code review/i, /\bbranch/i, /\bmerge/i, /repositor/i, /debug/i, /error recovery|stack trace|troubleshoot/i],
    pluginHints: ["github"]
  },
  {
    name: "Browser & QA",
    keywords: [/browser/i, /playwright/i, /chrome/i, /screenshot/i, /\bverif/i, /\btest/i, /\be2e\b/i, /devtools/i],
    pluginHints: ["browser", "chrome"]
  },
  {
    name: "Data & Payments",
    keywords: [/database|postgres|\bsql\b|supabase/i, /\bstorage\b|\bblob\b|\bkv\b|redis/i, /stripe|payment|billing|checkout/i, /\bcms\b|content management/i, /persistence/i],
    pluginHints: ["base44"]
  },
  {
    name: "AI & Media",
    keywords: [/\bai\b/i, /\bllm\b/i, /openai|anthropic|claude|\bgpt\b/i, /sora/i, /\bv0\b/i, /\bimage/i, /\bvideo/i, /\bmodels?\b/i, /prompt/i, /\bchat\b/i, /\bagents?\b/i],
    pluginHints: []
  },
  {
    name: "Research",
    keywords: [/research/i, /first principles/i, /analy[sz]/i, /compar(?:e|ison)/i, /evidence|citation|\bsources\b/i, /\bmarket\b/i, /investigat/i, /\bbrief\b/i],
    pluginHints: []
  },
  {
    name: "Frontend",
    keywords: [/react/i, /\bnext\.?js\b|next-forge/i, /frontend/i, /\bui\b/i, /\bux\b/i, /component/i, /tailwind|\bcss\b/i, /shadcn/i, /\bdesign/i, /landing/i, /website|web app/i, /geist/i, /satori/i, /\bfonts?\b/i, /\bswr\b/i],
    pluginHints: []
  },
  {
    name: "Deploy & Infra",
    keywords: [/deploy/i, /ci\/cd|cicd/i, /\bcron\b/i, /\bqueues?\b/i, /env(?:ironment)? var/i, /\bcli\b/i, /\bfunctions\b/i, /middleware/i, /routing/i, /\bcach(?:e|ing)\b/i, /observab|monitoring|\blogs\b/i, /monorepo|turborepo|turbopack/i, /sandbox/i, /\binfra/i, /hosting/i, /vercel/i, /\bedge\b/i, /compil/i, /marketplace/i, /\bplatform\b/i, /microservice|\bhttp\b/i],
    pluginHints: []
  },
  {
    name: "Skill Ops",
    keywords: [/skills?[- ]?(creator|installer)/i, /plugin/i, /create.{1,20}skill/i, /package.{1,20}skill/i, /skill\.md/i, /frontmatter/i, /\bcodex\b/i],
    pluginHints: []
  }
];

const FALLBACK_CATEGORY = "Tools";

function scoreCategories(skill) {
  const scores = CATEGORY_RULES.map((rule) => {
    // Plugin identity is handled only via explicit pluginHints — keyword
    // matches against the plugin name would bias every vercel:* skill
    // toward whichever category mentions "vercel".
    let score = 0;
    for (const keyword of rule.keywords) {
      if (keyword.test(skill.name)) score += 4;
      if (keyword.test(skill.description)) score += 1;
    }
    if (rule.pluginHints.includes(skill.plugin)) score += 5;
    return { name: rule.name, score };
  });

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const primary = ranked[0]?.score > 0 ? ranked[0].name : FALLBACK_CATEGORY;
  const secondary = ranked
    .slice(1)
    .filter((item) => item.score >= 3 && item.name !== primary)
    .slice(0, 2)
    .map((item) => item.name);

  return { primary, secondary };
}

/* ---------------------------------------------------------------------------
 * SKILL.md parsing
 * ------------------------------------------------------------------------- */

function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---")) return { fields: {}, body: markdown };
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return { fields: {}, body: markdown };
  const raw = markdown.slice(3, end);
  const body = markdown.slice(end + 4);
  const fields = {};
  // CRLF files leave a trailing \r on the last frontmatter line because the
  // closing delimiter is found via "\n---" — strip it or the line regex fails.
  const lines = raw.split(/\r?\n/).map((line) => line.replace(/\r$/, ""));

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, firstChunk] = match;
    let value = firstChunk.trim();

    // Folded (>) and literal (|) scalars, plus plain multi-line continuations:
    // consume every following line that is indented and not a new key.
    const chunks = [];
    if (value === ">" || value === "|" || value === ">-" || value === "|-" || value === "") {
      value = "";
    } else {
      chunks.push(value);
    }
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (/^[A-Za-z0-9_-]+:\s*/.test(next) || next.trim() === "") break;
      if (!/^\s+/.test(next)) break;
      chunks.push(next.trim());
      index += 1;
    }
    fields[key] = chunks.join(" ").replace(/^["']|["']$/g, "").trim();
  }

  return { fields, body };
}

function titleCase(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sentenceCase(value = "") {
  const cleaned = value.trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function firstSentence(value = "") {
  return value.split(/(?<=[.!?])\s+/).find(Boolean)?.trim() ?? value.trim();
}

function estimateSkillTokens(markdown = "") {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return 0;
  const pieces = text.match(/[A-Za-z0-9_]+|[\u4e00-\u9fff]|\S/g) ?? [];
  const estimated = pieces.reduce((total, piece) => {
    if (/^[A-Za-z0-9_]+$/.test(piece)) return total + Math.max(1, Math.ceil(piece.length / 4));
    return total + 1;
  }, 0);
  return Math.max(1, Math.round(estimated * 1.08));
}

function getSkillSizeStats(markdown = "") {
  return {
    skillSizeTokens: estimateSkillTokens(markdown),
    skillLineCount: markdown ? markdown.split(/\r?\n/).length : 0,
    skillWordCount: (markdown.match(/[A-Za-z0-9_]+/g) ?? []).length,
    skillTokenMethod: "local-estimate"
  };
}

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "with", "when", "use", "uses", "using", "into",
  "from", "this", "skill", "skills", "user", "asks", "local", "codex",
  "workflow", "workflows", "guidance", "expert", "building", "build", "create",
  "creating", "project", "projects", "should", "needs", "need", "through",
  "includes", "including", "like", "also", "them", "then", "your", "want",
  "wants", "whenever", "requests", "request", "trigger", "triggers"
]);

function tokenize(value = "") {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

/* ---------------------------------------------------------------------------
 * Derived activation content.
 *
 * The generator holds the full SKILL.md, so meaning is extracted here once,
 * instead of the client re-guessing from a lossy one-line description.
 * ------------------------------------------------------------------------- */

function extractSummary(description, name, category) {
  let sentence = firstSentence(description);
  if (!sentence) return `${name} provides ${category.toLowerCase()} support.`;
  sentence = sentence
    .replace(/^Use (?:this skill )?(?:whenever|when|any ?time) (?:the user|a user|users?) (?:asks?|wants?|says?|needs?|requests?)(?: (?:you )?to)?\s*/i, "Helps ")
    .replace(/^Use (?:this skill )?(?:whenever|when|to)\s*/i, "Helps with ")
    .replace(/^Helps with (?:the user|a user) (?:asks?|wants?|needs?)(?: to)?\s*/i, "Helps ");
  // Descriptions without sentence breaks can run hundreds of characters;
  // cut at the first clause boundary so the summary stays a summary.
  if (sentence.length > 160) {
    const clauseEnd = sentence.indexOf(";");
    sentence =
      clauseEnd > 40
        ? sentence.slice(0, clauseEnd)
        : `${sentence.slice(0, 157).replace(/\s+\S*$/, "")}…`;
  }
  return sentenceCase(sentence.trim());
}

function extractWhenToUse(description, body, name, category) {
  const fromDescription = description.match(
    /(?:use (?:this skill )?(?:whenever|when|any ?time)|trigger(?:s|ed)?(?: this)?(?: skill)? (?:with|when))\s+(.+?)(?=(?<=[a-z)\]"'])\.\s|;|$)/i
  )?.[1];
  if (fromDescription) {
    return sentenceCase(
      fromDescription
        .replace(/^the user (?:asks?|wants?|says?|needs?|requests?)(?: (?:you )?to)?\s*/i, "you need to ")
        .replace(/^to\s+/i, "you need to ")
        .trim()
    );
  }

  const section = body.match(/^#{2,4}\s*(?:when to use|triggers?|use (?:this|it) when)[^\n]*\n+([\s\S]*?)(?=\n#{1,4}\s|$)/im)?.[1];
  if (section) {
    const line = section
      .split(/\r?\n/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .find((item) => item.length > 12);
    if (line) return sentenceCase(line);
  }

  return `A task calls for ${category.toLowerCase()} work that matches ${name}.`;
}

const PROMPT_TEMPLATES = {
  "AI & Media": ["Plan a generation workflow with {name}.", "Turn this rough media idea into a finished asset plan."],
  Documents: ["Use {name} to inspect and improve this document.", "Produce a polished document from these notes."],
  Frontend: ["Use {name} to improve this screen, then verify it in the browser.", "Review this UI and tell me what should change before coding."],
  Research: ["Research this decision with current sources using {name}.", "Compare these options and produce a cited recommendation."],
  Security: ["Review this code path for risk with {name}.", "Trace this finding from source to sink and validate impact."],
  "Games & 3D": ["Plan the gameplay loop and assets with {name}.", "Playtest this browser game and report friction points."],
  "Code & Repos": ["Use {name} to inspect this pull request.", "Help me address unresolved review comments."],
  Email: ["Triage my inbox into action buckets with {name}.", "Draft a reply that preserves the thread context."],
  "Deploy & Infra": ["Debug this deployment issue with {name}.", "Recommend the right infra pattern for this feature."],
  "Data & Payments": ["Design the data flow for this feature with {name}.", "Review this integration for performance and reliability."],
  "Browser & QA": ["Drive the browser with {name} to verify this change.", "Test this flow end-to-end and report what breaks."],
  "Skill Ops": ["Improve this skill or plugin with {name}.", "Package this workflow as a reusable skill."],
  Tools: ["Apply {name} to this task.", "Show me the best way to use {name} here."]
};

function extractExamplePrompts(description, body, name, category) {
  const prompts = [];

  // Pattern A: enumerated trigger lists — "requests like: (i) do this, (ii) do that".
  const enumerated = description.match(/(?:requests?|things|tasks|examples?)\s+(?:like|such as|include)s?:?\s*(.+)$/i)?.[1];
  if (enumerated) {
    const parts = enumerated
      .split(/\((?:[ivx]+|\d+)\)/i)
      .map((part) => part.replace(/^[\s,;:.-]+|[\s,;:.]+$/g, ""))
      .filter((part) => part.length > 8 && part.length < 110);
    prompts.push(...parts);
  }

  // Pattern B: quoted trigger phrases — 'Trigger with "research [company]"'.
  for (const match of description.matchAll(/["“]([^"”]{8,90})["”]/g)) {
    prompts.push(match[1]);
  }

  // Pattern C: comma-separated verb phrases — "Use when the user asks to
  // research deeply, investigate a topic, compare options" → one prompt each.
  // The period terminator needs a lookahead so dotted names ("Next.js",
  // "sora.py") don't cut the clause short.
  const clause = description.match(
    /use (?:this skill )?when(?:ever)?(?: the user| a user| users)?(?: asks?| wants?| needs?| says?| requests?)?(?: (?:you )?to)?\s+(.+?)(?:\.(?=\s|$)|;|$)/i
  )?.[1];
  if (clause) {
    const phrases = clause
      .split(/,\s*(?:and\s+|or\s+)?|\s+—\s+/)
      .map((phrase) => phrase.replace(/^(?:and|or)\s+/i, "").trim())
      .filter(
        (phrase) =>
          phrase.length > 8 &&
          phrase.length < 80 &&
          /^[a-z]/.test(phrase) && // verb phrases are lowercase; "Server Components" is a noun, not a prompt
          /\s/.test(phrase) // lone nouns like "subscriptions" are not prompts
      );
    for (const phrase of phrases) {
      // Gerund phrases read badly as bare imperatives ("implementing
      // payments") — give them a natural prefix instead.
      prompts.push(/^[a-z]+ing\b/i.test(phrase) ? `Help me with ${phrase}` : phrase);
    }
  }

  // Pattern D: quoted or bulleted lines under example/trigger headings in the body.
  const section = body.match(/^#{2,4}\s*(?:examples?|triggers?|usage|try it)[^\n]*\n+([\s\S]*?)(?=\n#{1,4}\s|$)/im)?.[1];
  if (section) {
    for (const line of section.split(/\r?\n/)) {
      const quoted = line.match(/["“]([^"”]{8,90})["”]/)?.[1];
      if (quoted) prompts.push(quoted);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const prompt of prompts) {
    const cleaned = sentenceCase(prompt.replace(/\s+/g, " ").trim());
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
    if (unique.length === 3) break;
  }

  if (unique.length) return unique;
  return (PROMPT_TEMPLATES[category] ?? PROMPT_TEMPLATES.Tools).map((template) => template.replace("{name}", name));
}

function getCapabilities(description, category) {
  const sentences = description
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (sentences.length >= 2) return sentences;
  if (sentences.length === 1) return [sentences[0], `${category} workflow support`];
  return [`${category} workflow support`, "Local agent skill instructions"];
}

function makeTags(skill, secondaryCategories) {
  const words = tokenize(`${skill.name} ${skill.plugin}`);
  return Array.from(
    new Set([
      skill.source.toLowerCase(),
      slugify(skill.category),
      ...secondaryCategories.map(slugify),
      skill.plugin,
      ...words
    ])
  ).slice(0, 8);
}

function getMetadataCompleteness(skill) {
  const checks = [
    Boolean(skill.description && skill.description.length > 40),
    Boolean(skill.capabilities?.length >= 2),
    Boolean(skill.tags?.length >= 3),
    Boolean(skill.whenToUse && !skill.whenToUse.startsWith("A task calls for")),
    Boolean(skill.examplePrompts?.length && !skill.derivedPromptsAreFallback),
    Boolean(skill.updatedAt),
    Boolean(skill.description && skill.description.length > 120)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/* ---------------------------------------------------------------------------
 * Filesystem walk + source detection
 * ------------------------------------------------------------------------- */

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      files.push(fullPath);
    }
  }
  return files;
}

function getPluginInfo(filePath, root) {
  const relative = path.relative(root, filePath).split(path.sep);
  return {
    channel: relative[0] || "plugin",
    plugin: relative[1] || "unknown",
    version: relative[2] || "local"
  };
}

function getSource(filePath, sourceRoot) {
  if (sourceRoot.kind === "plugin") {
    return { source: sourceRoot.source, agent: sourceRoot.agent, ...getPluginInfo(filePath, sourceRoot.root) };
  }

  return {
    source: sourceRoot.source,
    agent: sourceRoot.agent,
    channel: sourceRoot.channel,
    plugin: sourceRoot.plugin,
    version: sourceRoot.version
  };
}

function compareVersions(a, b) {
  const partsA = String(a).split(".").map((part) => parseInt(part, 10));
  const partsB = String(b).split(".").map((part) => parseInt(part, 10));
  for (let index = 0; index < Math.max(partsA.length, partsB.length); index += 1) {
    const numA = Number.isNaN(partsA[index]) ? -1 : partsA[index] ?? 0;
    const numB = Number.isNaN(partsB[index]) ? -1 : partsB[index] ?? 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

function getQualifiedName(source, name) {
  if (source.source === "Plugin") return `${source.plugin}:${name}`;
  if (source.source !== "Personal" && source.source !== "System") return `${source.plugin}:${name}`;
  return name;
}

function getSourceRank(source) {
  const order = { Personal: 0, System: 1, Plugin: 2 };
  return order[source] ?? 3;
}

/* ---------------------------------------------------------------------------
 * Collect
 * ------------------------------------------------------------------------- */

function collectSkills() {
  const seenPaths = new Set();
  const files = sourceRoots.flatMap((sourceRoot) => {
    const excludedRoots = sourceRoot.exclude ?? [];
    return walk(sourceRoot.root)
      .filter((filePath) =>
        !excludedRoots.some((excludedRoot) =>
          path.normalize(filePath).startsWith(path.normalize(excludedRoot + path.sep))
        )
      )
      .map((filePath) => ({ filePath, sourceRoot }));
  });

  const parsed = files
    .filter(({ filePath }) => {
      const key = path.normalize(filePath).toLowerCase();
      if (seenPaths.has(key)) return false;
      seenPaths.add(key);
      return true;
    })
    .map(({ filePath, sourceRoot }) => {
      const markdown = fs.readFileSync(filePath, "utf8");
      const { fields: meta, body } = parseFrontmatter(markdown);
      const stat = fs.statSync(filePath);
      const source = getSource(filePath, sourceRoot);
      const folderName = path.basename(path.dirname(filePath));
      const name = meta.name || folderName;
      const description = meta.description || "Local agent skill instructions.";
      return { filePath, markdown, body, stat, source, folderName, name, description };
    });

  // Multiple cached versions of a plugin produce duplicate skills.
  // Keep only the newest version of each source|plugin|name identity.
  const byIdentity = new Map();
  for (const item of parsed) {
    const key = `${item.source.agent}|${item.source.source}|${item.source.plugin}|${item.name}`.toLowerCase();
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, item);
      continue;
    }
    const cmp = compareVersions(item.source.version, existing.source.version);
    const newer = cmp !== 0 ? cmp > 0 : item.stat.mtimeMs > existing.stat.mtimeMs;
    if (newer) byIdentity.set(key, item);
  }

  const duplicatesRemoved = parsed.length - byIdentity.size;

  const skills = [...byIdentity.values()].map(({ filePath, markdown, body, stat, source, folderName, name, description }) => {
    const { primary: category, secondary: secondaryCategories } = scoreCategories({
      name,
      description,
      plugin: source.plugin
    });
    const qualifiedName = getQualifiedName(source, name);
    const examplePrompts = extractExamplePrompts(description, body, qualifiedName, category);
    const derivedPromptsAreFallback =
      examplePrompts.length &&
      (PROMPT_TEMPLATES[category] ?? PROMPT_TEMPLATES.Tools).some(
        (template) => template.replace("{name}", qualifiedName) === examplePrompts[0]
      );

    const skill = {
      id: slugify(`${source.source}-${source.plugin}-${name}`),
      name,
      displayName: titleCase(name),
      qualifiedName,
      description,
      summary: extractSummary(description, qualifiedName, category),
      whenToUse: extractWhenToUse(description, body, qualifiedName, category),
      examplePrompts,
      derivedPromptsAreFallback,
      category,
      secondaryCategories,
      source: source.source,
      agent: source.agent,
      channel: source.channel,
      plugin: source.plugin,
      version: source.version,
      path: filePath,
      folder: folderName,
      updatedAt: stat.mtime.toISOString(),
      size: stat.size,
      ...getSkillSizeStats(markdown),
      capabilities: getCapabilities(description, category)
    };

    skill.tags = makeTags(skill, secondaryCategories);
    skill.tokens = Array.from(new Set(tokenize(`${name} ${description} ${skill.capabilities.join(" ")}`))).slice(0, 48);
    skill.completeness = getMetadataCompleteness(skill);
    return skill;
  });

  skills.sort((a, b) => {
    return (
      getSourceRank(a.source) - getSourceRank(b.source) ||
      a.agent.localeCompare(b.agent) ||
      a.category.localeCompare(b.category) ||
      a.qualifiedName.localeCompare(b.qualifiedName)
    );
  });

  return { skills, duplicatesRemoved };
}

const { skills, duplicatesRemoved } = collectSkills();
const totals = {
  all: skills.length,
  duplicatesRemoved,
  bySource: skills.reduce((acc, skill) => {
    acc[skill.source] = (acc[skill.source] || 0) + 1;
    return acc;
  }, {}),
  byCategory: skills.reduce((acc, skill) => {
    acc[skill.category] = (acc[skill.category] || 0) + 1;
    return acc;
  }, {}),
  byPlugin: skills.reduce((acc, skill) => {
    acc[skill.plugin] = (acc[skill.plugin] || 0) + 1;
    return acc;
  }, {}),
  byAgent: skills.reduce((acc, skill) => {
    acc[skill.agent] = (acc[skill.agent] || 0) + 1;
    return acc;
  }, {}),
  skillSizeTokens: skills.reduce((sum, skill) => sum + (skill.skillSizeTokens ?? 0), 0),
  bySourceSkillTokens: skills.reduce((acc, skill) => {
    acc[skill.source] = (acc[skill.source] || 0) + (skill.skillSizeTokens ?? 0);
    return acc;
  }, {}),
  byCategorySkillTokens: skills.reduce((acc, skill) => {
    acc[skill.category] = (acc[skill.category] || 0) + (skill.skillSizeTokens ?? 0);
    return acc;
  }, {})
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), totals, skills }, null, 2)
);

console.log(`Generated ${skills.length} skills (${duplicatesRemoved} duplicate plugin versions removed)`);
console.log("By category:", JSON.stringify(totals.byCategory, null, 2));
