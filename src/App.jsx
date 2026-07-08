import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuditView from "./components/AuditView.jsx";
import CenterStage from "./components/CenterStage.jsx";
import CommandDeck from "./components/CommandDeck.jsx";
import Footer from "./components/Footer.jsx";
import Header from "./components/Header.jsx";
import LeftRail from "./components/LeftRail.jsx";
import WorkflowsView from "./components/WorkflowsView.jsx";
import skillPayload from "./data/generated/skills.generated.json";
import usagePayload from "./data/generated/usage.generated.json";
import { getMissionResults } from "./lib/mission.js";
import { getRelatedSkills } from "./lib/relationships.js";
import { buildActivity, getActivityFor, loadUsage, markViewed } from "./lib/usage.js";
import { matchSkill } from "./lib/utils.js";

const RAIL_MIN_WIDTH = 248;
const RAIL_MAX_WIDTH = 440;
const RAIL_DEFAULT_WIDTH = 292;
const INSPECTOR_EXIT_MS = 390;

function clampRailWidth(value) {
  return Math.min(RAIL_MAX_WIDTH, Math.max(RAIL_MIN_WIDTH, value));
}

function getInitialRailWidth() {
  try {
    const stored = Number(window.localStorage.getItem("plasma:leftRailWidth"));
    return Number.isFinite(stored) ? clampRailWidth(stored) : RAIL_DEFAULT_WIDTH;
  } catch {
    return RAIL_DEFAULT_WIDTH;
  }
}

function App() {
  const allSkills = skillPayload.skills ?? [];
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All");
  const [category, setCategory] = useState("All");
  const [graphMode, setGraphMode] = useState("web");
  const [workspace, setWorkspace] = useState("explore");
  const [missionQuery, setMissionQuery] = useState("");
  const [focusNonce, setFocusNonce] = useState(0);
  const [railWidth, setRailWidth] = useState(getInitialRailWidth);
  const [inspectorSkillId, setInspectorSkillId] = useState(null);
  const [inspectorPhase, setInspectorPhase] = useState("closed");
  const [usage, setUsage] = useState(() => loadUsage());
  const inspectorExitTimer = useRef(null);

  useEffect(() => {
    window.localStorage.setItem("plasma:leftRailWidth", String(railWidth));
  }, [railWidth]);

  useEffect(() => {
    return () => {
      if (inspectorExitTimer.current) {
        window.clearTimeout(inspectorExitTimer.current);
      }
    };
  }, []);

  const openInspector = useCallback((skillId) => {
    if (inspectorExitTimer.current) {
      window.clearTimeout(inspectorExitTimer.current);
      inspectorExitTimer.current = null;
    }
    setInspectorSkillId(skillId);
    setInspectorPhase("open");
  }, []);

  const closeInspector = useCallback(() => {
    if (inspectorExitTimer.current) {
      window.clearTimeout(inspectorExitTimer.current);
      inspectorExitTimer.current = null;
    }

    if (!inspectorSkillId) {
      setInspectorPhase("closed");
      return;
    }

    setInspectorPhase("closing");
    inspectorExitTimer.current = window.setTimeout(() => {
      setInspectorSkillId(null);
      setInspectorPhase("closed");
      inspectorExitTimer.current = null;
    }, INSPECTOR_EXIT_MS);
  }, [inspectorSkillId]);

  // Deliberate selections record a view; automatic fallback selections
  // (initial load, filters removing the current skill) do not, so the
  // Unseen metric and Forgotten lens keep meaning something.
  const selectSkill = useCallback((skillId) => {
    if (selectedId !== skillId) {
      setUsage((current) => markViewed(current, skillId));
    }
    setSelectedId(skillId);
    openInspector(skillId);
  }, [openInspector, selectedId]);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    closeInspector();
  }, [closeInspector]);

  const beginRailResize = useCallback(
    (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = railWidth;

      const handleMove = (moveEvent) => {
        setRailWidth(clampRailWidth(startWidth + moveEvent.clientX - startX));
      };

      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [railWidth]
  );

  const handleRailResizeKeys = useCallback((event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setRailWidth((value) => clampRailWidth(value - 16));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setRailWidth((value) => clampRailWidth(value + 16));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setRailWidth(RAIL_MIN_WIDTH);
    }
    if (event.key === "End") {
      event.preventDefault();
      setRailWidth(RAIL_MAX_WIDTH);
    }
  }, []);

  const filteredSkills = useMemo(() => {
    return allSkills.filter((skill) => {
      const sourceMatch = source === "All" || skill.source === source;
      const categoryMatch = category === "All" || skill.category === category;
      return sourceMatch && categoryMatch && matchSkill(skill, query);
    });
  }, [allSkills, category, query, source]);

  useEffect(() => {
    if (!selectedId) return;
    if (!filteredSkills.some((skill) => skill.id === selectedId)) {
      clearSelection();
    }
  }, [clearSelection, filteredSkills, selectedId]);

  const selectedSkill = selectedId ? allSkills.find((skill) => skill.id === selectedId) ?? null : null;
  const inspectorSkill = inspectorSkillId ? allSkills.find((skill) => skill.id === inspectorSkillId) ?? null : null;

  const relatedSkills = useMemo(
    () => getRelatedSkills(allSkills, selectedSkill, 8),
    [allSkills, selectedSkill]
  );
  const inspectorRelatedSkills = useMemo(
    () => getRelatedSkills(allSkills, inspectorSkill, 8),
    [allSkills, inspectorSkill]
  );

  // Real Codex usage (generated from local session logs). Heat drives the
  // plasma renderer; the cold set drives the Forgotten lens and metrics.
  const activity = useMemo(() => buildActivity(usagePayload, allSkills), [allSkills]);

  // "Unseen" now means never invoked in Codex — the honest signal — and is
  // static per load, so the graph layout never churns on dashboard clicks.
  const unseenIds = useMemo(
    () =>
      new Set(
        allSkills
          .filter((skill) => getActivityFor(activity, skill.id).sessions === 0)
          .map((skill) => skill.id)
      ),
    [allSkills, activity]
  );

  const mission = useMemo(() => getMissionResults(missionQuery, allSkills, 6, activity), [missionQuery, allSkills, activity]);

  // While a mission is active, the graph dims everything except the matches.
  const missionIds = useMemo(() => {
    if (mission.routeSkillIds?.length) return new Set(mission.routeSkillIds);
    if (!mission.results.length) return null;
    return new Set(mission.results.map((item) => item.skill.id));
  }, [mission]);

  const clearFilters = () => {
    setQuery("");
    setSource("All");
    setCategory("All");
  };

  const handleExplore = (action = {}) => {
    if (action.mode) setGraphMode(action.mode);
    if (action.category) {
      setCategory(action.category);
      // Web and Topics both show category clusters; only leave lenses that don't.
      if (graphMode !== "web" && graphMode !== "sphere") setGraphMode("web");
    }
    if (action.source) {
      setSource(action.source);
      setGraphMode("source");
    }
    if (action.skillId) {
      setQuery("");
      setSource("All");
      setCategory("All");
      selectSkill(action.skillId);
    }
  };

  const centerSelected = () => setFocusNonce((value) => value + 1);

  const openSkillInExplore = useCallback(
    (skillId) => {
      setQuery("");
      setSource("All");
      setCategory("All");
      selectSkill(skillId);
      setWorkspace("explore");
    },
    [selectSkill]
  );

  const openCategoryInExplore = useCallback((nextCategory) => {
    setQuery("");
    setSource("All");
    setCategory(nextCategory);
    setWorkspace("explore");
  }, []);

  const inspectorGridClass = inspectorSkill
    ? inspectorPhase === "closing"
      ? "inspector-closing"
      : "inspector-open"
    : "inspector-closed";

  return (
    <main className={`vault-shell workspace-${workspace}`}>
      <div className="scanline" />
      <Header
        total={allSkills.length}
        workspace={workspace}
        setWorkspace={setWorkspace}
        skillQuery={query}
        setSkillQuery={setQuery}
      />
      {workspace === "explore" ? (
        <section
          className={`dashboard-grid ${inspectorGridClass}`}
          aria-label="Plasma skill graph"
          style={{ "--rail-width": `${railWidth}px` }}
        >
          <LeftRail
            allSkills={allSkills}
            filteredSkills={filteredSkills}
            selectedSkill={selectedSkill}
            generatedAt={skillPayload.generatedAt}
            activity={activity}
            query={query}
            source={source}
            setSource={setSource}
            category={category}
            setCategory={setCategory}
            selectSkill={selectSkill}
            clearFilters={clearFilters}
            onExplore={handleExplore}
            mission={mission}
            missionQuery={missionQuery}
            setMissionQuery={setMissionQuery}
          />
          <div
            className="rail-resizer"
            role="separator"
            aria-label="Resize left panel"
            aria-orientation="vertical"
            aria-valuemin={RAIL_MIN_WIDTH}
            aria-valuemax={RAIL_MAX_WIDTH}
            aria-valuenow={railWidth}
            tabIndex={0}
            onPointerDown={beginRailResize}
            onKeyDown={handleRailResizeKeys}
            onDoubleClick={() => setRailWidth(RAIL_DEFAULT_WIDTH)}
          />
          <CenterStage
            graphSkills={filteredSkills}
            selectedSkill={selectedSkill}
            relatedSkills={relatedSkills}
            selectSkill={selectSkill}
            clearFilters={clearFilters}
            graphMode={graphMode}
            setGraphMode={setGraphMode}
            activity={activity}
            unseenIds={unseenIds}
            focusNonce={focusNonce}
            missionQuery={missionQuery}
            missionIds={missionIds}
          />
          {inspectorSkill ? (
            <CommandDeck
              allSkills={allSkills}
              selectedSkill={inspectorSkill}
              relatedSkills={inspectorRelatedSkills}
              selectSkill={selectSkill}
              clearSelection={clearSelection}
              phase={inspectorPhase}
              usage={usage}
              activity={activity}
              onCenterSelected={centerSelected}
              mission={mission}
            />
          ) : null}
        </section>
      ) : workspace === "audit" ? (
        <AuditView
          allSkills={allSkills}
          filteredCount={filteredSkills.length}
          activity={activity}
          activeCategory={category}
          openSkill={openSkillInExplore}
          openCategory={openCategoryInExplore}
        />
      ) : (
        <WorkflowsView
          allSkills={allSkills}
          missionQuery={missionQuery}
          setMissionQuery={setMissionQuery}
          mission={mission}
          openSkill={openSkillInExplore}
        />
      )}
      <Footer generatedAt={skillPayload.generatedAt} usageSkipped={Boolean(usagePayload.skipped)} />
    </main>
  );
}

export default App;
