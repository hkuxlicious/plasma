import { Search } from "lucide-react";

const WORKSPACE_TABS = [
  { id: "explore", label: "Explore", hint: "What skills do I have?" },
  { id: "audit", label: "Audit", hint: "What is unused, duplicated, weak, or expensive?" }
];

const LOGO_ORBIT_DURATION = "9.6s";
const LOGO_SWEEP_BAND = 6.6;

function seededDotSize(index, latitude, phase) {
  const seed = Math.sin((index + 1) * 12.9898 + latitude * 78.233 + phase * 37.719) * 43758.5453;

  return seed - Math.floor(seed);
}

function makeLogoLane(count, latitude, phase, radius = 15.2) {
  const center = 18;
  const y = center + latitude;
  const amplitude = Math.sqrt(Math.max(0, radius ** 2 - latitude ** 2));
  const samples = Array.from({ length: 17 }, (_, index) => index / 16);
  const baseDotRadius = Math.max(0.78, 1.14 - Math.abs(latitude) * 0.018);

  return Array.from({ length: count }, (_, index) => {
    const sizeJitter = 0.76 + seededDotSize(index, latitude, phase) * 0.62;
    const theta = ((index / count) * Math.PI * 2) + phase;
    const dotRadius = Math.max(0.7, baseDotRadius * sizeJitter);
    const cxValues = samples.map((sample) => {
      const angle = theta + sample * Math.PI * 2;
      return (center + Math.cos(angle) * amplitude).toFixed(2);
    });
    const depthValues = samples.map((sample) => {
      const angle = theta + sample * Math.PI * 2;
      return (Math.sin(angle) + 1) / 2;
    });
    const glowOpacityValues = depthValues.map((depth) => {
      const frontOnly = Math.max(0, (depth - 0.42) / 0.58);

      return (frontOnly * 0.48).toFixed(2);
    });
    const highlightValues = depthValues.map((depth, sampleIndex) => {
      const progress = samples[sampleIndex];
      const sweep = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
      const sweepX = center - radius * 0.86 + sweep * radius * 1.72;
      const frontOnly = Math.max(0, (depth - 0.28) / 0.72);
      const band = Math.max(0, 1 - Math.abs(Number(cxValues[sampleIndex]) - sweepX) / LOGO_SWEEP_BAND);

      return Math.pow(band, 1.35) * frontOnly;
    });
    const glowRadiusValues = depthValues.map((depth, sampleIndex) => {
      const highlight = highlightValues[sampleIndex];

      return (dotRadius * (1.65 + depth * 1.85 + highlight * 2.55)).toFixed(3);
    });
    const opacityValues = depthValues.map((depth, sampleIndex) => {
      const highlight = highlightValues[sampleIndex];

      return Math.min(1, 0.24 + depth * 0.64 + highlight * 0.18).toFixed(2);
    });
    const radiusValues = depthValues.map((depth, sampleIndex) => {
      const highlight = highlightValues[sampleIndex];

      return (dotRadius * (0.84 + depth * 0.34 + highlight * 0.38)).toFixed(3);
    });
    const highlightOpacityValues = highlightValues.map((highlight) => (highlight * 0.92).toFixed(2));
    const highlightRadiusValues = depthValues.map((depth, sampleIndex) => {
      const highlight = highlightValues[sampleIndex];

      return (dotRadius * (1.08 + depth * 0.32 + highlight * 0.94)).toFixed(3);
    });

    return {
      cx: cxValues[0],
      cxValues: cxValues.join(";"),
      glowOpacity: glowOpacityValues[0],
      glowOpacityValues: glowOpacityValues.join(";"),
      glowR: glowRadiusValues[0],
      glowRadiusValues: glowRadiusValues.join(";"),
      highlightOpacity: highlightOpacityValues[0],
      highlightOpacityValues: highlightOpacityValues.join(";"),
      highlightR: highlightRadiusValues[0],
      highlightRadiusValues: highlightRadiusValues.join(";"),
      key: `${latitude}-${index}`,
      opacity: opacityValues[0],
      opacityValues: opacityValues.join(";"),
      r: radiusValues[0],
      radiusValues: radiusValues.join(";"),
      y: y.toFixed(2)
    };
  });
}

const ORB_DOTS = [
  ...makeLogoLane(6, -12, 0.2),
  ...makeLogoLane(9, -7, 0.82),
  ...makeLogoLane(12, -2, 1.28),
  ...makeLogoLane(12, 3, 0.44),
  ...makeLogoLane(9, 8, 1.58),
  ...makeLogoLane(6, 13, 0.96)
];

function AnimatedPlasmaLogo() {
  return (
    <div className="plasma-brand" role="img" aria-label="Plasma">
      <span className="plasma-logo-orb" aria-hidden="true">
        <span className="plasma-dot-cloud">
          <svg className="plasma-dot-field" viewBox="0 0 36 36" focusable="false">
            <defs>
              <radialGradient id="plasma-dot-sheen" cx="38%" cy="32%" r="72%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="42%" stopColor="#bffcff" />
                <stop offset="100%" stopColor="#43d7ff" />
              </radialGradient>
              <radialGradient id="plasma-sweep-haze" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.54" />
                <stop offset="52%" stopColor="#64efff" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#37d9ff" stopOpacity="0" />
              </radialGradient>
              <filter id="plasma-cyan-dot-glow" x="-160%" y="-160%" width="420%" height="420%">
                <feGaussianBlur stdDeviation="1.25" />
              </filter>
              <filter id="plasma-sweep-dot-glow" x="-180%" y="-180%" width="460%" height="460%">
                <feGaussianBlur stdDeviation="1.75" />
              </filter>
            </defs>
            <ellipse className="plasma-sweep-haze" cx="5" cy="18" rx="7.4" ry="16.5" opacity="0.04">
              <animate
                attributeName="cx"
                className="plasma-dot-motion"
                dur={LOGO_ORBIT_DURATION}
                repeatCount="indefinite"
                values="5;31;5"
              />
              <animate
                attributeName="opacity"
                className="plasma-dot-motion"
                dur={LOGO_ORBIT_DURATION}
                repeatCount="indefinite"
                values="0.04;0.22;0.04"
              />
            </ellipse>
            <g>
              {ORB_DOTS.map((dot, index) => (
                <g key={dot.key}>
                  <circle
                    cx={dot.cx}
                    cy={dot.y}
                    r={dot.glowR}
                    className="plasma-dot-glow"
                    opacity={dot.glowOpacity}
                  >
                    <animate
                      attributeName="cx"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.cxValues}
                    />
                    <animate
                      attributeName="opacity"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.glowOpacityValues}
                    />
                    <animate
                      attributeName="r"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.glowRadiusValues}
                    />
                  </circle>
                  <circle
                    cx={dot.cx}
                    cy={dot.y}
                    r={dot.r}
                    className="plasma-dot"
                    opacity={dot.opacity}
                  >
                    <animate
                      attributeName="cx"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.cxValues}
                    />
                    <animate
                      attributeName="opacity"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.opacityValues}
                    />
                    <animate
                      attributeName="r"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.radiusValues}
                    />
                  </circle>
                  <circle
                    cx={dot.cx}
                    cy={dot.y}
                    r={dot.highlightR}
                    className="plasma-dot-sheen-glow"
                    opacity={dot.highlightOpacity}
                  >
                    <animate
                      attributeName="cx"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.cxValues}
                    />
                    <animate
                      attributeName="opacity"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.highlightOpacityValues}
                    />
                    <animate
                      attributeName="r"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.highlightRadiusValues}
                    />
                  </circle>
                  <circle
                    cx={dot.cx}
                    cy={dot.y}
                    r={dot.highlightR}
                    className="plasma-dot-sheen"
                    opacity={dot.highlightOpacity}
                  >
                    <animate
                      attributeName="cx"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.cxValues}
                    />
                    <animate
                      attributeName="opacity"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.highlightOpacityValues}
                    />
                    <animate
                      attributeName="r"
                      className="plasma-dot-motion"
                      dur={LOGO_ORBIT_DURATION}
                      repeatCount="indefinite"
                      values={dot.highlightRadiusValues}
                    />
                  </circle>
                </g>
              ))}
            </g>
          </svg>
        </span>
      </span>
      <span className="plasma-wordmark" aria-hidden="true">PLASMA</span>
    </div>
  );
}

function Header({
  total,
  workspace,
  setWorkspace,
  skillQuery,
  setSkillQuery
}) {
  return (
    <header className="topbar">
      <div className="brand-stack">
        <div className="brand-row">
          <div className="brand-line">
            <AnimatedPlasmaLogo />
          </div>
          <nav className="topnav" aria-label="Workspace tabs" role="tablist">
            {WORKSPACE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={workspace === tab.id}
                className={workspace === tab.id ? "active" : ""}
                title={tab.hint}
                onClick={() => setWorkspace(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <p>{total} local skills mapped - local-first</p>
      </div>
      <label className="top-search">
        <Search size={15} />
        <input
          value={skillQuery}
          onChange={(event) => setSkillQuery(event.target.value)}
          placeholder="Search skills..."
          aria-label="Search skills"
        />
      </label>
    </header>
  );
}

export default Header;
