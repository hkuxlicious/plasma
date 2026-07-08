import { AlertTriangle, Gauge, GitCompareArrows, ScrollText, Snowflake } from "lucide-react";
import { useMemo } from "react";
import { CATEGORY_COLORS } from "../constants.js";
import { findOverlaps } from "../lib/overlap.js";
import { getCategoryStats } from "../lib/relationships.js";
import { getActivityFor } from "../lib/usage.js";
import { ageDays, compactNumber, formatTokenCount } from "../lib/utils.js";

function AuditMetric({ icon: Icon, label, value, hint, tone = "cyan" }) {
  return (
    <div className={`audit-metric tone-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function SkillRow({ skill, meta, value, onOpen }) {
  return (
    <button type="button" className="audit-skill-row" onClick={() => onOpen(skill.id)}>
      <span>{skill.qualifiedName}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </button>
  );
}

function InsightMetric({ label, value, hint, accent }) {
  return (
    <div className="insight-metric" style={{ "--accent": accent }}>
      <span>{label}</span>
      <strong>{compactNumber(value)}</strong>
      <small>{hint}</small>
    </div>
  );
}

function CategoryWheel({ items, total, activeCategory, onSelect }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const selected = items.find((item) => item.category === activeCategory);
  let offset = 0;
  const slices = items.map((item) => {
    const length = (item.count / Math.max(1, total)) * circumference;
    const slice = { ...item, length, offset };
    offset += length;
    return slice;
  });

  return (
    <div className="category-wheel">
      <div className="category-wheel-chart">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="category-wheel-track" cx="60" cy="60" r={radius} />
          {slices.map((item) => {
            const active = activeCategory === item.category;
            return (
              <circle
                key={item.category}
                className={`category-wheel-slice ${active ? "active" : ""}`}
                cx="60"
                cy="60"
                r={radius}
                stroke={item.color}
                strokeDasharray={`${item.length} ${circumference - item.length}`}
                strokeDashoffset={-item.offset}
                tabIndex="0"
                role="button"
                onClick={() => onSelect(active ? "All" : item.category)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelect(active ? "All" : item.category);
                }}
              >
                <title>{`${item.category}: ${item.count}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="category-wheel-total">
          <strong>{selected ? selected.count : total}</strong>
          <span>{selected ? "selected" : "skills"}</span>
        </div>
      </div>
      <div className="category-wheel-legend">
        {items.map((item) => {
          const active = activeCategory === item.category;
          return (
            <button
              key={item.category}
              type="button"
              className={active ? "active" : ""}
              style={{ "--accent": item.color }}
              onClick={() => onSelect(active ? "All" : item.category)}
            >
              <i />
              <span>{item.category}: </span>
              <strong>{compactNumber(item.count)}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AuditView({ allSkills, filteredCount, activity, activeCategory, openSkill, openCategory }) {
  const audit = useMemo(() => {
    const cold = allSkills
      .filter((skill) => getActivityFor(activity, skill.id).sessions === 0)
      .sort((a, b) => a.category.localeCompare(b.category) || a.qualifiedName.localeCompare(b.qualifiedName));

    const heavy = allSkills
      .map((skill) => {
        const record = getActivityFor(activity, skill.id);
        return {
          skill,
          footprint: record.estimatedFootprintTokens || 0,
          loadTokens: record.skillSizeTokens || skill.skillSizeTokens || 0,
          reads: record.reads || 0
        };
      })
      .sort((a, b) => b.footprint - a.footprint || b.loadTokens - a.loadTokens || b.reads - a.reads);

    const weak = [...allSkills]
      .filter((skill) => (skill.completeness ?? 0) < 80)
      .sort((a, b) => (a.completeness ?? 0) - (b.completeness ?? 0) || a.qualifiedName.localeCompare(b.qualifiedName));

    const stale = [...allSkills].sort((a, b) => ageDays(b.updatedAt) - ageDays(a.updatedAt));
    const overlaps = findOverlaps(allSkills, { limit: 8 });
    const totalFootprint = heavy.reduce((sum, item) => sum + item.footprint, 0);
    const hot = allSkills.filter((skill) => {
      const { lastInvokedAt } = getActivityFor(activity, skill.id);
      return lastInvokedAt && Date.now() - new Date(lastInvokedAt).getTime() < 14 * 86400000;
    }).length;
    const categoryStats = getCategoryStats(allSkills, CATEGORY_COLORS);

    return { cold, heavy, weak, stale, overlaps, totalFootprint, hot, categoryStats };
  }, [activity, allSkills]);

  return (
    <section className="workspace-board audit-workspace" aria-label="Skill audit">
      <div className="workspace-heading">
        <div>
          <h2>Audit</h2>
          <p>Maintenance signals for pruning, documenting, and keeping the library efficient.</p>
        </div>
        <span>local.only</span>
      </div>

      <div className="audit-metric-strip">
        <AuditMetric icon={Snowflake} label="Cold" value={audit.cold.length} hint="never invoked" tone="amber" />
        <AuditMetric
          icon={Gauge}
          label="Footprint"
          value={formatTokenCount(audit.totalFootprint)}
          hint="estimated load"
          tone="amber"
        />
        <AuditMetric icon={GitCompareArrows} label="Doubled" value={audit.overlaps.length} hint="possible overlap" />
        <AuditMetric icon={ScrollText} label="Thin Docs" value={audit.weak.length} hint="under 80% health" />
      </div>

      <div className="audit-overview-grid">
        <section className="workspace-section library-snapshot">
          <div className="workspace-section-title">
            <h3>Library Snapshot</h3>
            <span>{allSkills.length}</span>
          </div>
          <div className="metric-grid">
            <InsightMetric label="Total" value={allSkills.length} hint="installed skills" accent="#37d9ff" />
            <InsightMetric label="In Orbit" value={filteredCount} hint="current lens" accent="#8cf4ff" />
            <InsightMetric label="Cold" value={audit.cold.length} hint="never invoked" accent="#ffd166" />
            <InsightMetric label="Hot" value={audit.hot} hint="last 14d" accent="#ff6b8a" />
          </div>
        </section>

        <section className="workspace-section audit-constellations">
          <div className="workspace-section-title">
            <h3>Constellations</h3>
            <span>{audit.categoryStats.length}</span>
          </div>
          <p className="workspace-note">Overall category balance. Choose a category to open that lens in Explore.</p>
          <CategoryWheel
            items={audit.categoryStats}
            total={allSkills.length || 1}
            activeCategory={activeCategory}
            onSelect={openCategory}
          />
        </section>
      </div>

      <div className="workspace-columns audit-columns">
        <section className="workspace-section">
          <div className="workspace-section-title">
            <h3>Cold Skills</h3>
            <span>{audit.cold.length}</span>
          </div>
          <p className="workspace-note">Good candidates for discovery, cleanup, or better trigger wording.</p>
          <div className="audit-list">
            {audit.cold.slice(0, 12).map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                value={skill.category}
                meta={`${skill.source} - ${skill.completeness ?? 0}% health`}
                onOpen={openSkill}
              />
            ))}
          </div>
        </section>

        <section className="workspace-section">
          <div className="workspace-section-title">
            <h3>Heavy Footprint</h3>
            <span>{formatTokenCount(audit.totalFootprint)}</span>
          </div>
          <p className="workspace-note">Estimated SKILL.md load tokens multiplied by local reads.</p>
          <div className="audit-list">
            {audit.heavy.slice(0, 12).map(({ skill, footprint, loadTokens, reads }) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                value={formatTokenCount(footprint || loadTokens)}
                meta={`${formatTokenCount(loadTokens)} load x ${reads} reads`}
                onOpen={openSkill}
              />
            ))}
          </div>
        </section>

        <section className="workspace-section">
          <div className="workspace-section-title">
            <h3>Overlap & Health</h3>
            <AlertTriangle size={14} />
          </div>
          <p className="workspace-note">Pairs and stale/weak files that deserve human judgment.</p>
          <div className="overlap-audit-list">
            {audit.overlaps.map((pair) => (
              <div key={`${pair.a.id}-${pair.b.id}`} className="audit-pair">
                <div>
                  <button type="button" onClick={() => openSkill(pair.a.id)}>
                    {pair.a.qualifiedName}
                  </button>
                  <span>vs</span>
                  <button type="button" onClick={() => openSkill(pair.b.id)}>
                    {pair.b.qualifiedName}
                  </button>
                </div>
                <small>
                  {pair.verdict} - {Math.round(pair.coefficient * 100)}% shared
                  {pair.shared.length ? ` - ${pair.shared.slice(0, 3).join(", ")}` : ""}
                </small>
              </div>
            ))}
          </div>

          <div className="audit-list compact">
            {[...audit.weak.slice(0, 3), ...audit.stale.slice(0, 3)].map((skill) => (
              <SkillRow
                key={`health-${skill.id}`}
                skill={skill}
                value={`${skill.completeness ?? 0}%`}
                meta={`${ageDays(skill.updatedAt)}d since update`}
                onOpen={openSkill}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export default AuditView;
