import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");

function writeSkill(root, folder, frontmatter) {
  const skillDir = path.join(root, folder);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${frontmatter.name}\ndescription: ${frontmatter.description}\n---\n\n# ${frontmatter.name}\n\n${frontmatter.body}\n`,
    "utf8"
  );
}

test("generate-skills imports configured agent SKILL.md roots", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plasma-agent-roots-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  const codexRoot = path.join(tempRoot, "codex");
  const claudeRoot = path.join(tempRoot, "claude-skills");
  const geminiRoot = path.join(tempRoot, "gemini-skills");

  fs.mkdirSync(path.join(workspaceRoot, "src", "data", "generated"), { recursive: true });
  writeSkill(path.join(codexRoot, "skills"), "codex-helper", {
    name: "codex-helper",
    description: "Use when a Codex workflow needs local guidance.",
    body: "Codex compatible helper."
  });
  writeSkill(claudeRoot, "claude-research", {
    name: "claude-research",
    description: "Use when a Claude project needs reusable research instructions.",
    body: "Claude compatible research notes."
  });
  writeSkill(geminiRoot, "gemini-plan", {
    name: "gemini-plan",
    description: "Use when a Gemini workflow needs planning instructions.",
    body: "Gemini compatible plan."
  });

  const previousCwd = process.cwd();
  const previousCodexHome = process.env.CODEX_HOME;
  const previousAgentRoots = process.env.PLASMA_AGENT_SKILL_ROOTS;
  process.chdir(workspaceRoot);
  process.env.CODEX_HOME = codexRoot;
  process.env.PLASMA_AGENT_SKILL_ROOTS = `Claude=${claudeRoot}${path.delimiter}Gemini=${geminiRoot}`;

  try {
    await import(`${pathToFileURL(path.join(repoRoot, "scripts", "generate-skills.mjs")).href}?case=agent-roots`);
  } finally {
    process.chdir(previousCwd);
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    if (previousAgentRoots === undefined) {
      delete process.env.PLASMA_AGENT_SKILL_ROOTS;
    } else {
      process.env.PLASMA_AGENT_SKILL_ROOTS = previousAgentRoots;
    }
  }

  const generated = JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, "src", "data", "generated", "skills.generated.json"), "utf8")
  );
  const byName = new Map(generated.skills.map((skill) => [skill.name, skill]));

  assert.equal(byName.get("codex-helper")?.source, "Personal");
  assert.equal(byName.get("codex-helper")?.agent, "Codex");
  assert.equal(byName.get("claude-research")?.source, "Claude");
  assert.equal(byName.get("claude-research")?.agent, "Claude");
  assert.equal(byName.get("claude-research")?.qualifiedName, "claude:claude-research");
  assert.equal(byName.get("gemini-plan")?.source, "Gemini");
  assert.equal(generated.totals.bySource.Claude, 1);
  assert.equal(generated.totals.byAgent.Codex, 1);
  assert.equal(generated.totals.byAgent.Claude, 1);
  assert.equal(generated.totals.byAgent.Gemini, 1);
});
