import { Compass, Terminal } from "lucide-react";
import { GRAPH_MODES } from "../constants.js";
import ForceGraph from "./ForceGraph.jsx";
import SphereGraph from "./SphereGraph.jsx";

function CenterStage({
  graphSkills,
  selectedSkill,
  relatedSkills,
  selectSkill,
  clearFilters,
  graphMode,
  setGraphMode,
  activity,
  unseenIds,
  focusNonce,
  missionQuery,
  missionIds
}) {
  const topReason = relatedSkills[0]?.reasons?.[0];
  const hasMission = missionQuery.trim().length >= 3;

  return (
    <section className={`constellation-stage ${hasMission ? "has-route" : "plain"}`} aria-label="Skill sphere">
      <div className="graph-toolbar">
        <div className="mode-tabs" aria-label="Graph lens">
          {GRAPH_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                title={mode.hint}
                className={graphMode === mode.id ? "active" : ""}
                onClick={() => setGraphMode(mode.id)}
              >
                <Icon size={14} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
        <div className="graph-readout">
          <Compass size={14} />
          <span>{graphSkills.length} in orbit</span>
          {selectedSkill ? (
            <strong>
              {selectedSkill.qualifiedName}
              {topReason ? ` — ${topReason.toLowerCase()}` : ""}
            </strong>
          ) : null}
        </div>
      </div>

      <div className="graph-shell">
        {graphMode === "web" ? (
          <ForceGraph
            skills={graphSkills}
            selectedSkill={selectedSkill}
            relatedSkills={relatedSkills}
            selectSkill={selectSkill}
            focusNonce={focusNonce}
            highlightIds={missionIds}
            activity={activity}
          />
        ) : (
          <SphereGraph
            skills={graphSkills}
            selectedSkill={selectedSkill}
            relatedSkills={relatedSkills}
            selectSkill={selectSkill}
            graphMode={graphMode}
            unseenIds={unseenIds}
            focusNonce={focusNonce}
            highlightIds={missionIds}
            activity={activity}
          />
        )}
        {!graphSkills.length ? (
          <div className="empty-state">
            <Terminal size={20} />
            <strong>Empty orbit</strong>
            <p>Search and filters removed every skill from the sphere.</p>
            <button type="button" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default CenterStage;
