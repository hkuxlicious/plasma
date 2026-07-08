import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Github,
  GitCompareArrows,
  Link,
  Plus,
  Radio,
  Sparkles,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_COLORS, getSourceAccent } from "../constants.js";
import { getMissionResults } from "../lib/mission.js";
import { findOverlaps } from "../lib/overlap.js";
import { getCategoryStats, getOpportunities } from "../lib/relationships.js";
import { formatDate } from "../lib/utils.js";
import MissionBar, { RecommendedRoute } from "./MissionBar.jsx";

const STARTER_TASKS = [
  "redesign a frontend screen and verify it in the browser",
  "review code changes for bugs, tests, and security risk",
  "prepare docs or a PDF and polish the final artifact",
  "debug a deployment issue and inspect production signals"
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "app",
  "codex",
  "for",
  "github",
  "http",
  "https",
  "main",
  "master",
  "of",
  "skill",
  "skills",
  "the",
  "to",
  "tree",
  "www"
]);

const WEAK_GITHUB_TOKENS = new Set([
  "agent",
  "api",
  "chat",
  "client",
  "data",
  "demo",
  "folder",
  "link",
  "links",
  "page",
  "permalink",
  "post",
  "prep",
  "prompt",
  "prompts",
  "repo",
  "repository",
  "script",
  "server",
  "tool",
  "tools",
  "user",
  "web",
  "workflow",
  "workflows"
]);

const SOURCE_PRIORITY = { Personal: 0, System: 1, Plugin: 2 };

function getSourceBreakdown(skills) {
  const counts = skills.reduce((acc, skill) => {
    acc[skill.source] = (acc[skill.source] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => (SOURCE_PRIORITY[a.source] ?? 10) - (SOURCE_PRIORITY[b.source] ?? 10) || a.source.localeCompare(b.source));
}

function SectionTitle({ title, note }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <span>{note}</span>
    </div>
  );
}

function tokenize(value) {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token)))];
}

function normalizeKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatTokenList(tokens, limit = 5) {
  if (!tokens.length) return "none";
  const visible = tokens.slice(0, limit).join(", ");
  return tokens.length > limit ? `${visible}, +${tokens.length - limit} more` : visible;
}

function getSkillText(skill) {
  return [
    skill.qualifiedName,
    skill.category,
    skill.source,
    skill.summary,
    skill.whenToUse,
    ...(skill.tags ?? []),
    ...(skill.capabilities ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

function parseGithubSkill(input, allSkills) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: "Paste a full GitHub URL to analyze a skill source." };
  }

  if (!/(^|\.)github\.com$/i.test(parsed.hostname)) {
    return { valid: false, reason: "This importer currently understands GitHub links only." };
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return { valid: false, reason: "Use a GitHub repository or folder URL, for example github.com/owner/repo." };
  }

  const [owner, repo] = segments;
  const pathTokens = tokenize([repo, ...segments.slice(2)].join(" "));
  const fallbackTokens = tokenize(trimmed);
  const tokens = pathTokens.length ? pathTokens : fallbackTokens;
  const signalTokens = tokens.filter((token) => !WEAK_GITHUB_TOKENS.has(token));
  const ignoredTokens = tokens.filter((token) => WEAK_GITHUB_TOKENS.has(token));
  const repoKey = normalizeKey(repo);
  const scored = allSkills
    .map((skill) => {
      const skillTokens = new Set(tokenize(getSkillText(skill)));
      const skillKey = normalizeKey(skill.qualifiedName);
      const repoNameMatch = repoKey.length > 8 && skillKey.includes(repoKey);
      const matches = signalTokens.filter((token) => skillTokens.has(token));
      const score = matches.length * 22 + (repoNameMatch ? 80 : 0);
      return { skill, matches: repoNameMatch ? ["repo name", ...matches] : matches, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.qualifiedName.localeCompare(b.skill.qualifiedName));

  const categoryCounts = new Map();
  for (const item of scored.slice(0, 8)) {
    categoryCounts.set(item.skill.category, (categoryCounts.get(item.skill.category) ?? 0) + 1);
  }
  const categories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return {
    valid: true,
    owner,
    repo,
    url: parsed.href,
    tokens,
    signalTokens,
    ignoredTokens,
    command: `npx skills add ${parsed.href}`,
    categories,
    overlaps: scored.slice(0, 5)
  };
}

function ImportSkillDialog({ allSkills, onClose }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const analysis = useMemo(() => parseGithubSkill(url, allSkills), [allSkills, url]);

  const copyInstallCommand = async () => {
    if (!analysis?.valid) return;
    await navigator.clipboard?.writeText(analysis.command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="import-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="import-head">
          <div>
            <span>Local skill import</span>
            <h2 id="import-title">Analyze GitHub Skill</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close import dialog">
            <X size={17} />
          </button>
        </div>

        <label className="import-input">
          <Link size={15} />
          <input
            value={url}
            onChange={(event) => {
              setCopied(false);
              setUrl(event.target.value);
            }}
            placeholder="https://github.com/owner/repo"
            autoFocus
          />
        </label>

        {!analysis ? (
          <div className="import-empty">
            <Github size={18} />
            <strong>Paste a GitHub repo or folder link.</strong>
            <p>Plasma will compare its name and path against your local skill library before you install anything.</p>
          </div>
        ) : analysis.valid ? (
          <div className="import-analysis">
            <div className="import-summary">
              <Sparkles size={16} />
              <div>
                <strong>
                  {analysis.owner}/{analysis.repo}
                </strong>
                <span>
                  {analysis.categories.length
                    ? `URL-only local hint: ${analysis.categories.map(([category]) => category).join(", ")}`
                    : "No strong local match from the URL alone"}
                </span>
              </div>
            </div>

            <div className="import-section">
              <h3>Path signal</h3>
              <p>
                Plasma found {analysis.signalTokens.length || "no"} specific URL signal
                {analysis.signalTokens.length === 1 ? "" : "s"}: {formatTokenList(analysis.signalTokens)}.
                This is a local path-name check only; repository contents are not scanned yet.
              </p>
              {analysis.ignoredTokens.length ? (
                <p>Generic words ignored for overlap scoring: {formatTokenList(analysis.ignoredTokens)}.</p>
              ) : null}
            </div>

            <div className="import-section">
              <h3>Possible local overlap</h3>
              {analysis.overlaps.length ? (
                <div className="import-overlap-list">
                  {analysis.overlaps.map(({ skill, matches }) => (
                    <div key={skill.id}>
                      <GitCompareArrows size={14} />
                      <span>{skill.qualifiedName}</span>
                      <small>{matches.slice(0, 4).join(", ")} exact URL signal</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No obvious overlap from the GitHub path. A deeper scan would need the repository contents.</p>
              )}
            </div>

            <div className="import-actions">
              <button type="button" onClick={copyInstallCommand}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Command copied" : "Copy install command"}
              </button>
              <code>{analysis.command}</code>
            </div>
            <p className="import-note">
              For safety, this copies the local install command. A future installer bridge can run it after confirmation.
            </p>
          </div>
        ) : (
          <div className="import-warning">
            <AlertTriangle size={17} />
            <p>{analysis.reason}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function WorkflowRail({ allSkills, mission, missionQuery, setMissionQuery, selectSkill }) {
  const seeds = useMemo(
    () =>
      STARTER_TASKS.map((prompt) => ({
        prompt,
        name: prompt.split(" ").slice(0, 4).join(" ").replace(/^\w/, (char) => char.toUpperCase()),
        skills: getMissionResults(prompt, allSkills, 4).results.slice(0, 3)
      })),
    [allSkills]
  );
  return (
    <div className="rail-workflow-panel">
      <MissionBar
        query={missionQuery}
        setQuery={setMissionQuery}
        mission={mission}
        selectSkill={selectSkill}
        showRoute={false}
        showResults={false}
      />

      <RecommendedRoute mission={mission} selectSkill={selectSkill} variant="rail expanded" empty />

      <div className="rail-seed-list">
        <div className="activity-title">
          <h3>Starter bundles</h3>
          <span>{seeds.length}</span>
        </div>
        {seeds.map((seed) => (
          <section key={seed.prompt} className="rail-seed">
            <div>
              <strong>{seed.name}</strong>
              <button type="button" onClick={() => setMissionQuery(seed.prompt)}>
                Use
              </button>
            </div>
            <p>{seed.prompt}</p>
            <div>
              {seed.skills.map((item) => (
                <button key={item.skill.id} type="button" onClick={() => selectSkill(item.skill.id)} title={item.reason}>
                  <ArrowRight size={12} />
                  <span>{item.skill.qualifiedName}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function LeftRail({
  allSkills,
  filteredSkills,
  selectedSkill,
  generatedAt,
  activity,
  query,
  source,
  setSource,
  category,
  setCategory,
  selectSkill,
  clearFilters,
  onExplore,
  mission,
  missionQuery,
  setMissionQuery
}) {
  const [activeTab, setActiveTab] = useState("library");
  const [showImport, setShowImport] = useState(false);
  const sourceBreakdown = useMemo(() => getSourceBreakdown(allSkills), [allSkills]);
  const categoryStats = useMemo(() => getCategoryStats(allSkills, CATEGORY_COLORS), [allSkills]);
  const opportunities = getOpportunities(allSkills, activity, categoryStats);
  const overlaps = useMemo(() => findOverlaps(allSkills), [allSkills]);

  return (
    <aside className="rail left-rail" aria-label="Local skill library">
      <div className="library-heading">
        <div className="rail-tabs" role="tablist" aria-label="Left panel sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "library"}
            className={activeTab === "library" ? "active" : ""}
            onClick={() => setActiveTab("library")}
          >
            Library
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "workflow"}
            className={activeTab === "workflow" ? "active" : ""}
            onClick={() => setActiveTab("workflow")}
          >
            Workflow
          </button>
        </div>
      </div>

      <div key={activeTab} className="rail-tab-panel">
        {activeTab === "library" ? (
          <>
            <button type="button" className="library-import" onClick={() => setShowImport(true)}>
              <Plus size={16} />
              <span>
                <strong>Add GitHub Skill</strong>
                <small>Analyze fit and overlap first</small>
              </span>
            </button>

            <button
              type="button"
              className={`library-home ${category === "All" && source === "All" && !query ? "active" : ""}`}
              onClick={clearFilters}
            >
              <span>All skills</span>
              <strong>{allSkills.length}</strong>
            </button>

            <div className="library-source-row" aria-label="Source quick filters">
              {sourceBreakdown.map((item) => (
                <button
                  key={item.source}
                  type="button"
                  className={source === item.source ? "active" : ""}
                  style={{ "--accent": getSourceAccent(item.source) }}
                  onClick={() => setSource(source === item.source ? "All" : item.source)}
                >
                  <span>{item.source}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>

            <nav className="library-tree" aria-label="Skill categories">
              {categoryStats.slice(0, 8).map((item) => {
                const active = category === item.category;
                return (
                  <button
                    key={item.category}
                    type="button"
                    className={`library-row ${active ? "active" : ""}`}
                    style={{ "--accent": item.color }}
                    onClick={() => setCategory(active ? "All" : item.category)}
                  >
                    <i />
                    <span>{item.category}</span>
                    <strong>{item.count}</strong>
                  </button>
                );
              })}
            </nav>

            <div className="library-results" aria-label="Filtered skill list">
              <div className="activity-title">
                <h3>Skills</h3>
                <span>{filteredSkills.length}</span>
              </div>
              <div className="skill-index-list">
                {filteredSkills.slice(0, 24).map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className={selectedSkill?.id === skill.id ? "active" : ""}
                    onClick={() => selectSkill(skill.id)}
                  >
                    <span>{skill.qualifiedName}</span>
                    <small>{skill.category}</small>
                  </button>
                ))}
              </div>
              {filteredSkills.length > 24 ? <p className="index-note">Showing first 24. Search to narrow.</p> : null}
              {!filteredSkills.length ? (
                <button type="button" className="clear-button" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>

            <details className="rail-section quiet-details">
              <summary>Maintenance signals</summary>
              <div className="opportunity-list">
                {opportunities.map((item) => (
                  <button key={item.label} type="button" className="opportunity" onClick={() => onExplore(item.action)}>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                    <ArrowRight size={13} />
                  </button>
                ))}
              </div>
            </details>

            {overlaps.length ? (
              <details className="rail-section quiet-details">
                <summary>Doubled skills</summary>
                <div className="overlap-list">
                  {overlaps.slice(0, 5).map((pair) => (
                    <div key={`${pair.a.id}|${pair.b.id}`} className="overlap-pair">
                      <div className="overlap-names">
                        <button type="button" onClick={() => onExplore({ skillId: pair.a.id })}>
                          {pair.a.qualifiedName}
                        </button>
                        <span>vs</span>
                        <button type="button" onClick={() => onExplore({ skillId: pair.b.id })}>
                          {pair.b.qualifiedName}
                        </button>
                      </div>
                      <small>
                        {pair.verdict} - {Math.round(pair.coefficient * 100)}% shared language
                      </small>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <WorkflowRail
            allSkills={allSkills}
            mission={mission}
            missionQuery={missionQuery}
            setMissionQuery={setMissionQuery}
            selectSkill={selectSkill}
          />
        )}
      </div>

      <div className="last-sync">
        <Radio size={14} />
        <span>last scan</span>
        <strong>{formatDate(generatedAt)}</strong>
      </div>

      {showImport ? <ImportSkillDialog allSkills={allSkills} onClose={() => setShowImport(false)} /> : null}
    </aside>
  );
}

export default LeftRail;
export { SectionTitle };
