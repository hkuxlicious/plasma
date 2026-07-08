import { ArrowRight, Boxes, GitBranch, Rocket, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { getMissionResults } from "../lib/mission.js";
import MissionBar, { RecommendedRoute } from "./MissionBar.jsx";

const STARTER_TASKS = [
  "redesign a frontend screen and verify it in the browser",
  "review code changes for bugs, tests, and security risk",
  "prepare docs or a PDF and polish the final artifact",
  "debug a deployment issue and inspect production signals"
];

function WorkflowSeed({ name, prompt, skills, onUse, openSkill }) {
  return (
    <section className="workflow-seed">
      <div>
        <h3>{name}</h3>
        <button type="button" onClick={() => onUse(prompt)}>
          <Rocket size={13} />
          Use mission
        </button>
      </div>
      <p>{prompt}</p>
      <div className="workflow-seed-skills">
        {skills.map((item, index) => (
          <button key={item.skill.id} type="button" onClick={() => openSkill(item.skill.id)} title={item.reason}>
            {index > 0 ? <ArrowRight size={12} /> : <Sparkles size={12} />}
            <span>{item.skill.qualifiedName}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WorkflowsView({ allSkills, missionQuery, setMissionQuery, mission, openSkill }) {
  const seeds = useMemo(() => {
    return STARTER_TASKS.map((prompt) => ({
      prompt,
      name: prompt
        .split(" ")
        .slice(0, 4)
        .join(" ")
        .replace(/^\w/, (char) => char.toUpperCase()),
      skills: getMissionResults(prompt, allSkills, 4).results.slice(0, 4)
    }));
  }, [allSkills]);

  return (
    <section className="workspace-board workflows-workspace" aria-label="Workflow builder">
      <div className="workspace-heading">
        <div>
          <h2>Workflows</h2>
          <p>What should I use for this task? Describe the mission and Plasma will route you through your local toolkit.</p>
        </div>
        <span>mission.route</span>
      </div>

      <div className="workspace-columns workflow-columns">
        <section className="workspace-section workflow-mission workflow-active-mission">
          <div className="workspace-section-title">
            <h3>Active Mission</h3>
            <Rocket size={14} />
          </div>
          <MissionBar
            query={missionQuery}
            setQuery={setMissionQuery}
            mission={mission}
            selectSkill={openSkill}
            showRoute={false}
            showResults={false}
          />
          <p className="workflow-active-text">
            {missionQuery.trim()
              ? "The route panel updates as you type."
              : "Describe a task here, or choose a starter bundle to load one."}
          </p>
          {missionQuery.trim() ? (
            <button type="button" className="workflow-clear" onClick={() => setMissionQuery("")}>
              Clear mission
            </button>
          ) : null}
        </section>

        <section className="workspace-section workflow-route">
          <div className="workspace-section-title">
            <h3>Recommended Route</h3>
            <GitBranch size={14} />
          </div>
          <p className="workspace-note">Best local path for the active mission, with reasons and a copyable workflow prompt.</p>
          <RecommendedRoute mission={mission} selectSkill={openSkill} variant="calm expanded" empty />
        </section>

        <section className="workspace-section workflow-bundles">
          <div className="workspace-section-title">
            <h3>Starter Bundles</h3>
            <Boxes size={14} />
          </div>
          <p className="workspace-note">Generated from your installed skills. Bundle saving can come next.</p>
          <div className="workflow-seed-list">
            {seeds.map((seed) => (
              <WorkflowSeed
                key={seed.prompt}
                name={seed.name}
                prompt={seed.prompt}
                skills={seed.skills}
                onUse={setMissionQuery}
                openSkill={openSkill}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export default WorkflowsView;
