import { ArrowRight, Check, Copy, GitBranch, Rocket, Sparkles, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

function getMissionPayload(mission, results = [], chain = []) {
  return mission ?? {
    results,
    chain,
    route: chain,
    routeConfidence: 0,
    copyPrompt: "",
    routeSkillIds: chain.map((item) => item.skill.id)
  };
}

function RecommendedRoute({ mission, selectSkill, variant = "compact", empty = false }) {
  const route = mission?.route ?? mission?.chain ?? [];
  const copyTimerRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const copyRoute = async () => {
    if (!mission?.copyPrompt) return;
    await navigator.clipboard?.writeText(mission.copyPrompt);
    setCopied(true);
    window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  if (!route.length) {
    if (!empty) return null;
    return (
      <div className={`mission-route-card ${variant}`}>
        <div className="mission-route-empty">
          <GitBranch size={16} />
          <strong>No route yet</strong>
          <span>Describe a mission to light up the best path through your local skill library.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`mission-route-card ${variant}`} aria-label="Recommended mission route">
      <div className="mission-route-head">
        <div>
          <span>Recommended Route</span>
          <strong>{mission.routeConfidence ? `${mission.routeConfidence}% fit` : `${route.length} steps`}</strong>
        </div>
        {mission.copyPrompt ? (
          <button type="button" onClick={copyRoute}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy route"}
          </button>
        ) : null}
      </div>

      <div className="mission-route-steps">
        {route.map((item, index) => (
          <Fragment key={item.skill.id}>
            {index > 0 ? <ArrowRight className="mission-route-arrow" size={13} /> : null}
            <button
              type="button"
              className={`mission-route-step stage-${item.stageId}`}
              onClick={() => selectSkill(item.skill.id)}
              title={`${item.stageLabel}: ${item.reason}`}
            >
              <small>{item.stageLabel}</small>
              <strong>{item.skill.qualifiedName}</strong>
              <span>{item.reason}</span>
              <em>
                {item.skill.source} / {item.skill.category}
              </em>
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function MissionBar({ query, setQuery, mission, results, chain, selectSkill, showRoute = true, showResults = true }) {
  const payload = getMissionPayload(mission, results, chain);
  const active = query.trim().length >= 3;
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [query]);

  return (
    <div className="mission-bar" aria-label="Mission route suggestions">
      <div className="mission-input">
        <Rocket size={15} />
        <div className="mission-input-copy">
          <span>Mission Route</span>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Describe a task, e.g. redesign a landing page and verify it in browser"
            aria-label="Describe your task to get a mission route"
            rows={2}
            spellCheck="true"
          />
        </div>
        {query ? (
          <button type="button" className="mission-clear" onClick={() => setQuery("")} title="Clear mission">
            <X size={13} />
          </button>
        ) : null}
      </div>

      {active && showResults ? (
        payload.results.length ? (
          <div className="mission-results">
            {showRoute ? <RecommendedRoute mission={payload} selectSkill={selectSkill} /> : null}
            <div className="mission-list" aria-label="Additional matching skills">
              {payload.results.map(({ skill, score, reason, usageReason }) => (
                <button key={skill.id} type="button" onClick={() => selectSkill(skill.id)} title={usageReason ?? reason}>
                  <Sparkles size={12} />
                  <span>{skill.qualifiedName}</span>
                  <small>{Math.min(99, score)}</small>
                  <em>{reason}</em>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mission-empty">
            No installed skill matches this task. Try different words, or this is a gap in your local library worth filling.
          </div>
        )
      ) : null}
    </div>
  );
}

export default MissionBar;
export { RecommendedRoute };
