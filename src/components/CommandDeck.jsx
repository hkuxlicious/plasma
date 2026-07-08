import {
  ArrowRight,
  Check,
  Copy,
  Crosshair,
  Gauge,
  GitCompareArrows,
  Sparkles,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_ICONS } from "../constants.js";
import { findOverlaps } from "../lib/overlap.js";
import { getActivityFor, getUsageForSkill } from "../lib/usage.js";
import { ageDays, formatTokenCount } from "../lib/utils.js";
import { SectionTitle } from "./LeftRail.jsx";

function ActivationBlock({ title, children }) {
  return (
    <section className="activation-block">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function TokenMetric({ label, value, hint }) {
  return (
    <div className="token-metric" aria-label={`${label}: ${value}; ${hint}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function TokenFootprintPanel({ allSkills, activity, selectedSkill, selectSkill }) {
  const ranked = useMemo(() => {
    return allSkills
      .map((skill) => {
        const skillActivity = getActivityFor(activity, skill.id);
        return {
          skill,
          reads: skillActivity.reads,
          sessions: skillActivity.sessions,
          loadTokens: skillActivity.skillSizeTokens || skill.skillSizeTokens || 0,
          footprint: skillActivity.estimatedFootprintTokens || 0
        };
      })
      .sort((a, b) => b.footprint - a.footprint || b.loadTokens - a.loadTokens || b.reads - a.reads)
      .slice(0, 7);
  }, [activity, allSkills]);

  const totalFootprint = useMemo(() => {
    return allSkills.reduce((sum, skill) => sum + getActivityFor(activity, skill.id).estimatedFootprintTokens, 0);
  }, [activity, allSkills]);

  return (
    <div className="rail-section token-footprint-panel">
      <div className="activity-title">
        <h3>Token Footprint</h3>
        <Gauge size={14} />
      </div>
      <p className="rail-note">Context cost estimate: SKILL.md load tokens multiplied by real local reads.</p>
      <div className="token-total" aria-label={`Library footprint: ${formatTokenCount(totalFootprint)}`}>
        <span>Library footprint</span>
        <strong>{formatTokenCount(totalFootprint)}</strong>
      </div>
      <div className="token-rank-list">
        {ranked.map((item) => {
          const active = selectedSkill?.id === item.skill.id;
          return (
            <button
              key={item.skill.id}
              type="button"
              className={active ? "active" : ""}
              onClick={() => selectSkill(item.skill.id)}
              title={`${formatTokenCount(item.loadTokens)} load tokens x ${item.reads} reads`}
              aria-label={`${item.skill.qualifiedName}: ${formatTokenCount(item.footprint)} footprint, ${formatTokenCount(item.loadTokens)} load tokens times ${item.reads} reads`}
            >
              <span>{item.skill.qualifiedName}</span>
              <strong>{formatTokenCount(item.footprint)}</strong>
              <small>
                {formatTokenCount(item.loadTokens)} x {item.reads} reads
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getStarterPrompt(skill) {
  return skill.examplePrompts?.[0] ?? `Use ${skill.qualifiedName} when the task is: ${skill.whenToUse}`;
}

function PossibleOverlap({ pairs, skill, selectSkill }) {
  return (
    <ActivationBlock title="Possible overlap">
      {pairs.length ? (
        <div className="workbench-overlap-list">
          {pairs.map((pair) => {
            const other = pair.a.id === skill.id ? pair.b : pair.a;
            return (
              <button key={`${pair.a.id}-${pair.b.id}`} type="button" onClick={() => selectSkill(other.id)}>
                <GitCompareArrows size={13} />
                <span>{other.qualifiedName}</span>
                <small>
                  {pair.verdict} / {Math.round(pair.coefficient * 100)}% shared
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <p>No likely duplicate or competing trigger found in the current library.</p>
      )}
    </ActivationBlock>
  );
}

function RouteSteps({ mission, selectedSkill, selectSkill }) {
  const route = mission?.route ?? [];
  if (!route.length) return null;

  return (
    <section className="workbench-route">
      <div className="activity-title">
        <h3>Route Steps</h3>
        <span>{mission.routeConfidence ? `${mission.routeConfidence}%` : route.length}</span>
      </div>
      <div className="workbench-route-list">
        {route.map((item) => {
          const active = selectedSkill?.id === item.skill.id;
          return (
            <button
              key={item.skill.id}
              type="button"
              className={active ? "active" : ""}
              onClick={() => selectSkill(item.skill.id)}
              title={item.reason}
            >
              <small>{item.stageLabel}</small>
              <span>{item.skill.qualifiedName}</span>
              <em>{item.reason}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedSkill({ allSkills, skill, relatedSkills, selectSkill, usage, activity, onCenterSelected }) {
  const Icon = CATEGORY_ICONS[skill.category] ?? Wrench;
  const skillUsage = getUsageForSkill(usage, skill.id);
  const skillActivity = getActivityFor(activity, skill.id);
  const starterPrompt = getStarterPrompt(skill);
  const overlapPairs = useMemo(
    () => findOverlaps(allSkills, { limit: 16 }).filter((pair) => pair.a.id === skill.id || pair.b.id === skill.id),
    [allSkills, skill.id]
  );
  const [copiedKey, setCopiedKey] = useState(null);
  const copyTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const copyText = async (key, text) => {
    await navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1600);
  };

  return (
    <div className="selected-skill">
      <div className="selected-heading">
        <div className="selected-icon">
          <Icon size={24} />
        </div>
        <div>
          <h3>{skill.qualifiedName}</h3>
          <p>{skill.summary}</p>
        </div>
        <span className="status-dot">enabled</span>
      </div>

      <dl className="meta-grid">
        <div>
          <dt>Source</dt>
          <dd>{skill.source}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{skill.category}</dd>
        </div>
        <div>
          <dt>Invoked</dt>
          <dd
            title={
              skillActivity.sessions
                ? `${skillActivity.sessions} local sessions - ${skillActivity.reads} loads - last ${ageDays(skillActivity.lastInvokedAt)}d ago - viewed here ${skillUsage.views}x`
                : `never invoked in local sessions - viewed here ${skillUsage.views}x`
            }
          >
            {skillActivity.sessions ? `${skillActivity.sessions}x` : "cold"}
          </dd>
        </div>
        <div>
          <dt>Load</dt>
          <dd title="Estimated tokens to load this SKILL.md">
            {formatTokenCount(skillActivity.skillSizeTokens || skill.skillSizeTokens || 0)}
          </dd>
        </div>
        <div>
          <dt>Footprint</dt>
          <dd title="Estimated SKILL.md load tokens multiplied by local reads">
            {formatTokenCount(skillActivity.estimatedFootprintTokens || 0)}
          </dd>
        </div>
        <div>
          <dt>Health</dt>
          <dd>{skill.completeness ?? 0}%</dd>
        </div>
      </dl>

      <div className="selected-actions">
        <button type="button" onClick={onCenterSelected}>
          <Crosshair size={13} />
          Center in graph
        </button>
        <button type="button" onClick={() => copyText("path", skill.path)}>
          {copiedKey === "path" ? <Check size={13} /> : <Copy size={13} />}
          {copiedKey === "path" ? "Copied" : "Copy path"}
        </button>
      </div>

      <ActivationBlock title="What it does">
        <p>{skill.summary}</p>
      </ActivationBlock>

      <ActivationBlock title="When to use">
        <p>{skill.whenToUse}</p>
      </ActivationBlock>

      <ActivationBlock title="Best next action">
        <div className="best-action">
          <p>{starterPrompt}</p>
          <button type="button" onClick={() => copyText("starter", starterPrompt)}>
            {copiedKey === "starter" ? <Check size={13} /> : <Sparkles size={13} />}
            {copiedKey === "starter" ? "Copied" : "Copy action"}
          </button>
        </div>
      </ActivationBlock>

      <ActivationBlock title="Pairs well with">
        <div className="related-list">
          {relatedSkills.slice(0, 5).map(({ skill: related, score, reasons }) => {
            const RelatedIcon = CATEGORY_ICONS[related.category] ?? Wrench;
            return (
              <button
                key={related.id}
                type="button"
                onClick={() => selectSkill(related.id)}
                title={reasons.join(" | ")}
              >
                <RelatedIcon size={14} />
                <span>{related.qualifiedName}</span>
                <small>{Math.min(99, score)} match</small>
                <ArrowRight size={14} />
                <em>{reasons[0]}</em>
              </button>
            );
          })}
        </div>
      </ActivationBlock>

      <PossibleOverlap pairs={overlapPairs} skill={skill} selectSkill={selectSkill} />

      <ActivationBlock title="Token footprint">
        <div className="token-metric-grid">
          <TokenMetric
            label="Skill size"
            value={formatTokenCount(skillActivity.skillSizeTokens || skill.skillSizeTokens || 0)}
            hint="estimated load"
          />
          <TokenMetric label="Reads" value={skillActivity.reads} hint="local logs" />
          <TokenMetric
            label="Footprint"
            value={formatTokenCount(skillActivity.estimatedFootprintTokens || 0)}
            hint="size x reads"
          />
        </div>
      </ActivationBlock>

      <details className="raw-details">
        <summary>Raw details</summary>
        <div className="tag-row">
          {skill.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="capability-list">
          <h4>Capabilities</h4>
          <ul>
            {skill.capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </div>
        <div className="path-row">
          <code>{skill.path}</code>
        </div>
      </details>
    </div>
  );
}

function SelectionEmpty() {
  return (
    <div className="rail-section selected-empty">
      <Sparkles size={15} />
      <div>
        <h3>No skill selected</h3>
        <p>Pick a skill to inspect its role, overlap, and best workflow use.</p>
      </div>
    </div>
  );
}

function CommandDeck({
  allSkills,
  selectedSkill,
  relatedSkills,
  selectSkill,
  clearSelection,
  phase = "open",
  usage,
  activity,
  onCenterSelected,
  mission
}) {
  return (
    <aside className={`rail command-deck is-${phase}`} aria-label="Selected skill workbench">
      <div className="workbench-top">
        <SectionTitle title="Skill Workbench" note="activation.page" />
        <button type="button" className="workbench-close" onClick={clearSelection} aria-label="Close skill workbench">
          <X size={17} />
        </button>
      </div>

      <SelectedSkill
        allSkills={allSkills}
        skill={selectedSkill}
        relatedSkills={relatedSkills}
        selectSkill={selectSkill}
        usage={usage}
        activity={activity}
        onCenterSelected={onCenterSelected}
      />

      <RouteSteps mission={mission} selectedSkill={selectedSkill} selectSkill={selectSkill} />

      <details className="workbench-utility">
        <summary>Library signals</summary>
        <TokenFootprintPanel
          allSkills={allSkills}
          activity={activity}
          selectedSkill={selectedSkill}
          selectSkill={selectSkill}
        />
      </details>
    </aside>
  );
}

export default CommandDeck;
