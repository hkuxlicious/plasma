import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Scans local Codex session transcripts (read-only) for real skill
 * invocations and writes src/data/generated/usage.generated.json.
 *
 * Privacy default: transcript scanning is opt-in. Run with `--scan` or set
 * SKILL_DASHBOARD_SCAN_USAGE=1. Without that, the script writes an empty
 * usage file only when one does not already exist.
 *
 * Two signals, discovered by inspecting the rollout JSONL format:
 *
 * 1. SKILL.md reads — Codex loads a skill by running a shell command that
 *    reads its SKILL.md (e.g. `Get-Content C:\...\skills\playwright\SKILL.md`).
 *    Any function_call / custom_tool_call whose arguments contain a SKILL.md
 *    path under the Codex root counts as an invocation.
 * 2. $skill tags — user messages containing `$name` where name matches an
 *    installed skill (explicit invocation syntax, e.g. `$sora`).
 *
 * Counting: `sessions` = number of distinct sessions the skill was used in
 * (the meaningful number), `reads` = raw SKILL.md reads. Run AFTER
 * generate-skills so the id mapping matches the current library.
 */

const workspaceRoot = process.cwd();
const codexRoot = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const sessionsRoot = path.join(codexRoot, "sessions");
const generatedDataRoot = path.join(workspaceRoot, "src", "data", "generated");
const skillsPath = path.join(generatedDataRoot, "skills.generated.json");
const outputPath = path.join(generatedDataRoot, "usage.generated.json");
const shouldScanUsage = process.argv.includes("--scan") || process.env.SKILL_DASHBOARD_SCAN_USAGE === "1";

function writeEmptyUsage(reason) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sessionsScanned: 0,
        linesParsed: 0,
        skillsWithUsage: 0,
        skipped: true,
        reason,
        unmatched: {},
        usage: {}
      },
      null,
      2
    )
  );
}

if (!shouldScanUsage) {
  if (!fs.existsSync(outputPath)) {
    writeEmptyUsage("Transcript scanning is opt-in. Run npm run generate:local to include local usage.");
    console.log("Usage scan skipped. Wrote empty local usage data.");
  } else {
    console.log("Usage scan skipped. Existing local usage data preserved.");
  }
  console.log("Run npm run generate:local or set SKILL_DASHBOARD_SCAN_USAGE=1 to scan Codex session transcripts.");
  process.exit(0);
}

const skillPayload = JSON.parse(fs.readFileSync(skillsPath, "utf8"));
const skills = skillPayload.skills ?? [];

// plugin|folder uniquely identifies a skill across sources and survives
// plugin version changes (cache paths embed a version segment).
const byPluginFolder = new Map();
const byName = new Map();
for (const skill of skills) {
  byPluginFolder.set(`${skill.plugin}|${skill.folder}`.toLowerCase(), skill.id);
  const nameKey = skill.name.toLowerCase();
  if (!byName.has(nameKey)) byName.set(nameKey, []);
  byName.get(nameKey).push(skill.id);
}

function classifySkillPath(rawPath) {
  const normalized = rawPath.replace(/\//g, "\\");
  if (!/\.codex\\/i.test(normalized)) return null; // project-local SKILL.md files are not library skills
  const segments = normalized.split("\\").filter(Boolean);
  const folder = segments[segments.length - 2];
  if (!folder) return null;

  const cacheIndex = segments.findIndex((s, i) => s.toLowerCase() === "plugins" && segments[i + 1]?.toLowerCase() === "cache");
  if (cacheIndex !== -1) {
    const plugin = segments[cacheIndex + 3]; // plugins/cache/<channel>/<plugin>/<version>/skills/<folder>/SKILL.md
    if (!plugin) return null;
    return `${plugin}|${folder}`.toLowerCase();
  }
  if (segments.some((s) => s.toLowerCase() === ".system")) return `system|${folder}`.toLowerCase();
  if (segments.some((s) => s.toLowerCase() === "skills")) return `user|${folder}`.toLowerCase();
  return null;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (entry.name.endsWith(".jsonl")) files.push(fullPath);
  }
  return files;
}

const SKILL_MD_PATTERN = /[A-Za-z]:[\\/][^\s"'`]*?SKILL\.md/g;
const TAG_PATTERN = /\$([a-z][a-z0-9-]{2,})/g;

const records = new Map(); // skillId -> { reads, sessions:Set, lastInvokedAt, firstInvokedAt }
const unmatched = new Map();

function credit(skillId, sessionId, timestamp) {
  let record = records.get(skillId);
  if (!record) {
    record = { reads: 0, sessions: new Set(), lastInvokedAt: null, firstInvokedAt: null };
    records.set(skillId, record);
  }
  record.reads += 1;
  record.sessions.add(sessionId);
  if (!record.lastInvokedAt || timestamp > record.lastInvokedAt) record.lastInvokedAt = timestamp;
  if (!record.firstInvokedAt || timestamp < record.firstInvokedAt) record.firstInvokedAt = timestamp;
}

const sessionFiles = walk(sessionsRoot);
let parsedLines = 0;

for (const file of sessionFiles) {
  const sessionId = path.basename(file, ".jsonl");
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    parsedLines += 1;
    const payload = entry.payload;
    if (!payload) continue;
    const timestamp = entry.timestamp ?? null;

    // Signal 1: SKILL.md reads inside tool-call arguments.
    if (payload.type === "function_call" || payload.type === "custom_tool_call") {
      const args = String(payload.arguments ?? payload.input ?? "");
      if (args.includes("SKILL.md")) {
        for (const match of args.matchAll(SKILL_MD_PATTERN)) {
          const key = classifySkillPath(match[0]);
          if (!key) continue;
          const skillId = byPluginFolder.get(key);
          if (skillId) credit(skillId, sessionId, timestamp);
          else unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
        }
      }
      continue;
    }

    // Signal 2: $skill tags in user messages.
    let userText = null;
    if (entry.type === "event_msg" && payload.type === "user_message") {
      userText = String(payload.message ?? "");
    } else if (payload.type === "message" && payload.role === "user") {
      userText = (payload.content ?? [])
        .map((part) => part?.text ?? "")
        .join(" ");
    }
    if (userText && userText.includes("$")) {
      for (const match of userText.matchAll(TAG_PATTERN)) {
        const ids = byName.get(match[1].toLowerCase());
        if (!ids) continue;
        for (const skillId of ids) credit(skillId, sessionId, timestamp);
      }
    }
  }
}

const usage = {};
for (const [skillId, record] of records) {
  usage[skillId] = {
    reads: record.reads,
    sessions: record.sessions.size,
    firstInvokedAt: record.firstInvokedAt,
    lastInvokedAt: record.lastInvokedAt
  };
}

const output = {
  generatedAt: new Date().toISOString(),
  sessionsScanned: sessionFiles.length,
  linesParsed: parsedLines,
  skillsWithUsage: records.size,
  unmatched: Object.fromEntries(unmatched),
  usage
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const top = [...records.entries()]
  .sort((a, b) => b[1].sessions.size - a[1].sessions.size)
  .slice(0, 8)
  .map(([id, record]) => `${id} (${record.sessions.size} sessions, ${record.reads} reads)`);
console.log(`Scanned ${sessionFiles.length} sessions; ${records.size} skills with real usage.`);
console.log("Top used:", top.join(" | ") || "none");
if (unmatched.size) console.log("Unmatched (uninstalled/old skills):", [...unmatched.keys()].join(", "));
