import {
  AppWindow,
  Brain,
  Cloud,
  Database,
  FileText,
  Gamepad2,
  Github,
  Globe,
  Layers3,
  Mail,
  Monitor,
  Network,
  Puzzle,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  Wrench
} from "lucide-react";

export const SOURCE_ACCENTS = {
  Personal: "#ffd166",
  System: "#7fffd4",
  Plugin: "#37d9ff"
};

const SOURCE_ACCENT_PALETTE = [
  "#d7b3ff",
  "#ff9a8a",
  "#9fd5ff",
  "#9dffb8",
  "#ffb86b",
  "#8cf4ff",
  "#f0f6ff"
];

function hashSource(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function getSourceAccent(source) {
  if (SOURCE_ACCENTS[source]) return SOURCE_ACCENTS[source];
  return SOURCE_ACCENT_PALETTE[hashSource(source) % SOURCE_ACCENT_PALETTE.length];
}

export const CATEGORY_COLORS = {
  "AI & Media": "#d7b3ff",
  "Browser & QA": "#ffb86b",
  "Code & Repos": "#f0f6ff",
  "Data & Payments": "#9fd5ff",
  "Deploy & Infra": "#ffffff",
  Documents: "#8cf4ff",
  Email: "#ff9a8a",
  Frontend: "#37d9ff",
  "Games & 3D": "#9dffb8",
  Research: "#ffd166",
  Security: "#ff6b8a",
  "Skill Ops": "#7fffd4",
  Tools: "#b8ccd3"
};

export const CATEGORY_ICONS = {
  "AI & Media": Sparkles,
  "Browser & QA": AppWindow,
  "Code & Repos": Github,
  "Data & Payments": Database,
  "Deploy & Infra": Cloud,
  Documents: FileText,
  Email: Mail,
  Frontend: Monitor,
  "Games & 3D": Gamepad2,
  Research: Brain,
  Security: ShieldCheck,
  "Skill Ops": Server,
  Tools: Wrench
};

export const GRAPH_MODES = [
  { id: "web", label: "Web", icon: Network, hint: "Physics-based skill web — drag, pin, pan, zoom" },
  { id: "sphere", label: "Topics", icon: Globe, hint: "Category constellations on the globe" },
  { id: "plugin", label: "Plugins", icon: Puzzle, hint: "Skills clustered by the plugin that provides them" },
  { id: "source", label: "Source", icon: Database, hint: "Skill sources and agent libraries" },
  { id: "focus", label: "Focus", icon: Target, hint: "Selected skill and its companions up front" },
  { id: "forgotten", label: "Forgotten", icon: Layers3, hint: "Uninspected skills brought forward" }
];
