# Skill Dashboard Development Handoff

Last updated: 2026-07-06, post-commit `0c3e8d5`

## Latest State For Next Chat

Local checkpoint:

- Latest local commit: `0c3e8d5` (`Refine dashboard workspaces for open source`).
- Worktree was clean immediately after that commit.
- Latest verified preview URL: `http://127.0.0.1:4181/`.
- Latest build command verified: `npm run build`.
- Generated skill inventory in the latest build: `103` skills, with `6`
  duplicate plugin versions removed.

Product and UI:

- Product name is `Plasma`.
- The top navigation is now real workspace tabs:
  - `Explore`: center graph + guidance/search/workbench.
  - `Audit`: cold skills, token footprint, overlap/health, Library Snapshot,
    and Constellations/category wheel.
  - `Workflows`: mission planner, suggested chain, and starter bundles.
- Explore now starts with no selected skill. Do not reintroduce a default
  selected skill such as `deep-research`; the workbench intentionally shows a
  "No skill selected" empty state until the user clicks a node or skill row.
- `Library Snapshot` and `Constellations` live in Audit, not Explore.
- Clicking a skill from Audit/Workflows jumps back to Explore and selects it.
  Clicking a category in the Audit constellation wheel opens that category
  lens in Explore.

Hard user preference:

- Do not change the center graph, connected skills, 3D sphere, or plasma visual
  effects unless the user explicitly asks. The current plasma graph/glass
  sphere is approved and loved.
- Graph node icons remain hidden by default and appear only on hover/focus.

Open-source posture:

- Generated data moved to ignored runtime files under `src/data/generated/`.
- `npm run generate` preserves existing local usage data and does not scan
  Codex transcripts by default.
- `npm run generate:local` or `SKILL_DASHBOARD_SCAN_USAGE=1` opt into local
  session scanning.
- New project docs/files added for open-source readiness:
  `README.md`, `PRIVACY.md`, `LICENSE`, `.env.example`.

Important implementation files:

- `src/App.jsx`: workspace tab state, no-default-selection behavior, routing
  between Explore/Audit/Workflows.
- `src/components/Header.jsx`: real workspace tab buttons.
- `src/components/AuditView.jsx`: audit workspace, Library Snapshot,
  Constellations, cold/heavy/overlap/health panels.
- `src/components/WorkflowsView.jsx`: mission planner and starter bundles.
- `src/components/CommandDeck.jsx`: no-selection empty state and token
  footprint panel.
- `src/components/ForceGraph.jsx`, `src/components/SphereGraph.jsx`, and
  `src/lib/plasma.js`: protected visual core; avoid casual edits.

Latest QA:

- `npm run build` passed.
- In-app browser verification on `http://127.0.0.1:4181/` showed:
  - Explore active by default.
  - No selected skill card.
  - `0` selected graph nodes.
  - Plasma canvas present.
  - Library Snapshot and Constellations absent from Explore.
  - Audit contains Library Snapshot, Constellations, 4 audit metric cards, and
    12 category-wheel buttons.
  - No console warnings/errors.

## v5.1–v5.2 Changes

- Product is now named "Plasma" (header, title, footer). Brand accent is
  plasma violet.
- Sphere lenses render as a plasma globe: magenta core, tendrils to skills
  with real usage, no straight SVG edges while plasma is on (canvas
  filaments are the single link language in both lenses; SVG lines are the
  Zap-off fallback). Tendril branches removed — no stray sparks.
- Apple-glass shell: near-invisible rim + speculars; the sphere is revealed
  by an aurora layer (drifting ribbons + heat blooms) clipped inside the
  globe. See IMPROVEMENTS.md section 12.

## v5 Changes

- Real usage telemetry: `scripts/scan-usage.mjs` can scan local Codex session
  transcripts (read-only) for actual skill invocations (SKILL.md reads +
  $skill tags) when explicitly run via `npm run generate:local` or
  `SKILL_DASHBOARD_SCAN_USAGE=1`. It writes ignored runtime data to
  `src/data/generated/usage.generated.json`.
- Heat model in `src/lib/usage.js` (frequency x recency, 0 for never
  invoked) drives everything: Cold/Hot metrics, Forgotten lens, Expeditions,
  "Invoked N×" in the skill panel.
- Plasma renderer: canvas underlay beneath the Web lens SVG
  (`src/lib/plasma.js` + paint loop in ForceGraph). Glow = heat, filaments =
  relationships, discharge arcs on selection, lightning on mission matches.
  Zap control toggles it; reduced-motion renders static. Zero new deps.
- See `IMPROVEMENTS.md` sections 10-11 for format findings and gotchas.

## v4.2 Changes

- Mission bar (top of center stage): describe a task, get ranked skill
  suggestions with reasons, a plan→build→verify chain, and live graph
  highlighting (non-matches dim in both graphs). `src/lib/mission.js`,
  `src/components/MissionBar.jsx`.
- Overlap advisor (left rail): skill pairs likely competing for the same
  triggers — same-name duplicates across sources + overlap coefficient on
  generator tokens. `src/lib/overlap.js`.
- Client tokenizer added to `src/lib/utils.js` (keeps short domain words the
  generator drops).
- Next planned: usage-from-sessions spike (real Codex invocation counts) —
  see `IMPROVEMENTS.md` for the full suggestion-features thinking record.

## v4.1 Changes

- New default graph lens "Web": Obsidian-style force-directed layout via
  `d3-force` (simulation only; rendering is the same custom SVG language as
  the sphere). Files: `src/lib/force.js`, `src/components/ForceGraph.jsx`.
- Drag nodes, double-click to pin, drag background to pan, wheel zoom,
  category anchor forces + centroid cluster labels, top-2-relationship edges
  with reason tooltips, smooth reheat on filter changes (positions persist).
- Sphere lenses (Topics/Plugins/Source/Focus/Forgotten) unchanged.
- See `IMPROVEMENTS.md` for full detail and the next planned step
  (workflow bundles).

## v4 Changes (most recent)

Generator (`scripts/generate-skills.mjs`) was rewritten:

- Categories are now purely topical, scored (not first-regex-match): every
  keyword hit in the name scores 4, in the description 1; `pluginHints` add 5.
  Highest score wins, earlier rules win ties. Plugins are never categories —
  "Vercel" as a category is gone; its 47 skills spread across Deploy & Infra,
  Frontend, AI & Media, Data & Payments, Security, Email.
- Current categories: AI & Media, Browser & QA, Code & Repos, Data & Payments,
  Deploy & Infra, Documents, Email, Frontend, Games & 3D, Research, Security,
  Skill Ops, Tools (fallback).
- Duplicate plugin versions are deduped by `source|plugin|name`, keeping the
  newest version (6 duplicates removed; 108 → 102 skills).
- Activation content is derived at generation time from the full SKILL.md
  (summary, whenToUse, examplePrompts, tokens, completeness, secondary
  categories). ~80/102 skills get real prompts extracted from their own
  trigger lists; the rest fall back to category templates
  (`derivedPromptsAreFallback: true`).
- Frontmatter parser handles CRLF files and multi-line YAML values. Careful:
  the closing `---` is found via `\n---`, so lines must be stripped of a
  trailing `\r` (regression fixed in this pass).
- Skill ids are now `slugify(source-plugin-name)` — stable and free of
  filesystem paths (old ids embedded the full path). localStorage usage data
  keyed on old ids resets once.

App was split out of the single-file `src/App.jsx` (1,745 lines → thin shell):

- `src/constants.js` — colors, icons, graph modes.
- `src/lib/sphere.js` — all 3D math, lens layouts, edges, cluster label anchors.
- `src/lib/relationships.js` — explainable scoring (uses generator tokens).
- `src/lib/usage.js` — localStorage view tracking.
- `src/lib/utils.js` — hashing, formatting, search matching.
- `src/components/` — Header, LeftRail, CenterStage, SphereGraph, CommandDeck,
  Footer.

Behavior fixes and features in v4:

- New "Plugins" graph lens (spherical caps per plugin, plugin-mesh edges).
- Cluster region labels on the sphere for Topics/Plugins/Source lenses
  (front-facing only, depth-faded, `.cluster-label` in styles.css).
- Views are recorded only on deliberate selection (`selectSkill`), not on the
  initial default selection or automatic fallback when filters change — the
  Unseen metric and Forgotten lens stay meaningful.
- Graph layout no longer rebuilds on every view-count change; the Forgotten
  lens depends on a memoized unseen-id set keyed by membership.
- Same-plugin relationship bonus only applies when both skills are real
  plugin skills (personal skills all share plugin "user" and were previously
  scored as one family).
- `@vitejs/plugin-react` is now actually wired in `vite.config.js` (it was in
  dependencies but never in plugins; JSX previously used the classic
  transform, so components had to import React explicitly — no longer).

## Purpose

This workspace contains a local Codex skill dashboard inspired by the supplied dark V.A.U.L.T.-style HUD reference. v3 turns the center graph into a 3D knowledge sphere ("skill universe"): all installed skills float on a rotatable, zoomable globe with category clusters, depth-based fading, library intelligence, filters, selected skill activation guidance, related workflow reasons, and copyable local skill paths.

The user specifically requested that graph node icons should not show in the middle by default. Nodes stay as connected dots by default, and icons appear only on hover/focus.

## Current Status

- App is implemented as a React + Vite frontend.
- Skill data is generated locally from `SKILL.md` files.
- Current generated inventory: `103` skills (after plugin-version dedupe).
- Default selected skill: none. Explore intentionally opens without a
  selected skill.
- Latest static server used for verification: `http://127.0.0.1:4181`.
- Production build passes with `npm run build`.
- Current workspace tabs: `Explore`, `Audit`, `Workflows`.
- Current product brief: `PROJECT_BRIEF.md`.
- Current improvement log: `IMPROVEMENTS.md`.

## v3 3D Sphere Graph (current center stage)

The flat force graph was replaced by a dependency-free 3D sphere renderer in `src/App.jsx` (`SphereGraph` component, SVG-based, ~108 nodes at 60fps):

- Every skill has a fixed unit vector on a unit sphere per lens (`computeBaseVectors`).
  Category clusters are spherical caps sized by member count, placed via Fibonacci
  directions, so related skills are spatially close by construction.
- Yaw/pitch rotation state lives in refs; a single rAF loop handles focus easing,
  drag inertia, idle auto-rotation, and node drift between lens layouts.
- Perspective projection: `persp = camDist / (camDist - z)`. Front nodes are
  larger/brighter; back nodes are smaller/dimmer (opacity 0.15–1.0). Edge opacity
  is `min(endpointAlpha)` so lines fade with depth.
- Drag anywhere rotates the sphere (click vs drag disambiguated via a moved flag
  reset on pointerdown). Wheel zoom moves the camera (2.05–5.2).
- Selecting a skill (graph click, index list, related list) eases the sphere so
  that node rotates to the front. "Center in sphere" button re-triggers via a
  `focusNonce` counter in `App`.
- Lenses: `sphere` (category caps), `source` (latitude bands: Personal top,
  System mid, Plugin south), `focus` (selected at front pole, companions in rings
  around it, everything else dimmed on the back hemisphere), `forgotten` (unseen
  skills on the front hemisphere, viewed skills behind).
- Edges: explainable spokes from the selected skill (top related, with reasons in
  `<title>` tooltips) plus a sparse nearest-neighbour mesh within each category.
- Labels are sparse: selected + hovered + ~6 frontmost (more when zoomed in or in
  focus lens). Hover/focus reveals an icon plate + category sub-label.
- Shell chrome: starfield, atmosphere gradient, silhouette circle, and three
  great-circle rings split into front/back path segments for depth.
- Controls (right edge, vertical): center selected, zoom in/out, auto-rotate
  toggle, reset view. Legend bottom-left, interaction hints bottom-right.
- Left rail is exploration-first: clickable category "constellations" (set the
  category filter), clickable source orbits, and "Expeditions" that jump to a
  lens/filter. Right rail keeps activation-first content plus "Center in sphere"
  and "Copy path" actions.
- Respects `prefers-reduced-motion` (no auto-rotation, near-instant easing).

## Project Structure

```text
.
+-- DEVELOPMENT_HANDOFF.md
+-- .gitignore
+-- index.html
+-- package.json
+-- package-lock.json
+-- vite.config.js
+-- assets/
|   +-- skill-dashboard-concept.png
+-- scripts/
|   +-- generate-skills.mjs
|   +-- scan-usage.mjs
|   +-- serve-dist.mjs
+-- src/
    +-- App.jsx            (thin shell: state + composition)
    +-- constants.js       (colors, icons, graph modes)
    +-- main.jsx
    +-- styles.css
    +-- components/
    |   +-- Header.jsx
    |   +-- LeftRail.jsx
    |   +-- CenterStage.jsx
    |   +-- ForceGraph.jsx
    |   +-- SphereGraph.jsx
    |   +-- CommandDeck.jsx
    |   +-- AuditView.jsx
    |   +-- WorkflowsView.jsx
    |   +-- MissionBar.jsx
    |   +-- Footer.jsx
    +-- lib/
    |   +-- force.js
    |   +-- mission.js
    |   +-- overlap.js
    |   +-- plasma.js
    |   +-- sphere.js
    |   +-- relationships.js
    |   +-- usage.js
    |   +-- utils.js
    +-- data/
        +-- generated/      (ignored local runtime data)
```

Ignored/generated:

- `node_modules/`
- `dist/`
- `.vite/`
- `server-*.log`
- `src/data/generated/`
- `output/playwright/`

## Important Files

- `src/App.jsx`
  Main React app. Contains the app shell, library intelligence rail, force-style graph, graph mode state, command deck, selected-skill activation panel, local view tracking, filtering/search state, and explainable related-skill logic.

- `src/styles.css`
  Full visual system for the dark HUD interface. Includes desktop/mobile responsive layout, force graph styling, category/source regions, activation panels, and the hover-only node icon behavior:

  ```css
  .graph-node .node-icon { opacity: 0; }
  .graph-node:hover .node-icon,
  .graph-node:focus-visible .node-icon { opacity: 1; }
  ```

- `scripts/generate-skills.mjs`
  Scans local Codex skill roots and writes `src/data/generated/skills.generated.json`.

- `scripts/serve-dist.mjs`
  Tiny Node static server for serving `dist/`. This was added because Vite dev/preview had Windows sandbox issues in this environment.

- `assets/skill-dashboard-concept.png`
  Generated UI concept used as the visual reference.

- `src/components/AuditView.jsx`
  Audit workspace. Owns Library Snapshot, Constellations/category wheel, cold
  skills, heavy token footprint, overlap, and health panels.

- `src/components/WorkflowsView.jsx`
  Workflow workspace. Owns the mission planner, suggested chain, and starter
  bundles.

## Skill Data Flow

The generator scans:

```text
CODEX_HOME/skills
CODEX_HOME/skills/.system
CODEX_HOME/plugins/cache
```

It parses `SKILL.md` frontmatter, infers:

- source: `Personal`, `System`, or `Plugin`
- category
- tags
- capabilities
- path
- updated time
- plugin/channel/version

The output is:

```text
src/data/generated/skills.generated.json
src/data/generated/usage.generated.json
```

`npm run build` runs `npm run generate` first, so skill data refreshes
automatically before production builds. The default usage generation preserves
existing local usage data and does not scan Codex transcripts. Run
`npm run generate:local` for the explicit opt-in local transcript scan.

## Commands

Install dependencies:

```powershell
npm install
```

Regenerate skills:

```powershell
npm run generate:skills
```

Regenerate skills and scan local Codex usage:

```powershell
npm run generate:local
```

Build:

```powershell
npm run build
```

Serve built app:

```powershell
npm run serve -- 4181
```

Then open:

```text
http://127.0.0.1:4181
```

Vite dev server exists:

```powershell
npm run dev
```

But during this session, Vite dev/preview triggered Windows sandbox `spawn EPERM` problems in some paths. The static `serve-dist.mjs` route was the reliable verification path.

## UX And Visual Notes

- No human face or webcam overlay is included.
- The layout follows the supplied reference:
  - dark near-black terminal background
  - cyan/ice-blue glow
  - left telemetry rail
  - central constellation graph
  - right command/detail deck
  - bottom total skill metric
- Center graph opens in the `Web` lens: an Obsidian-style force graph with
  plasma canvas filaments under the SVG node layer.
- Center graph lens modes:
  - Web (default force graph)
  - Topics / Sphere (category clusters on the glass globe)
  - Plugins
  - Source
  - Focus (selected + companions up front)
  - Forgotten
- Web graph behavior uses `d3-force` simulation logic with custom SVG/canvas
  rendering. Sphere behavior uses dependency-free 3D projection math.
- Users can pan/zoom/drag/pin nodes in Web, rotate/zoom the sphere lenses, and
  click nodes to activate a skill.
- Node colors:
  - Personal: amber
  - System: mint
  - Plugin: cyan
- Icons in the graph are hidden by default and show only on hover/focus.
- Search and filters update the graph and skill index live.
- Selected-skill panel is activation-first:
  - summary
  - when to use
  - example prompts
  - related workflows with connection reasons
  - metadata health and raw details
- Left rail is now "Library Intelligence" rather than generic system vitals.
- Local view counts are stored in `localStorage` under `skill-dashboard-usage`.

## Verification Completed

Latest verification (2026-07-06, after commit `0c3e8d5`):

- `npm run build` passed and generated `103` skills.
- In-app browser checks against `http://127.0.0.1:4181/` passed.
- Explore opens by default with no selected skill card and `0` selected graph
  nodes.
- Plasma canvas is present in Explore.
- `Library Snapshot` and `Constellations` are absent from Explore and present
  in Audit.
- Audit contains 4 metric cards and 12 category-wheel buttons.
- Browser console warnings/errors: none.
- Older v2/v3 screenshot artifacts were removed from Git and
  `output/playwright/` is now ignored.

Historical notes below are kept for context only.

Build:

```text
npm run build
Generated 103 skills in the latest build; older builds generated 108 before dedupe changes
Vite build succeeded
```

Browser smoke checks:

- Latest graph inventory renders from 103 generated skills.
- Default selected skill: none in the current app.
- Default selected category: `All`.
- `visibleIcons: 0` by default.
- Searching `github` narrowed the graph/index to `13` nodes.
- Hover/focus CSS rule exists and reveals node icons only on hover/focus.

Visual verification artifacts:

```text
output/playwright/skill-dashboard-desktop.png
output/playwright/skill-dashboard-mobile.png
output/playwright/skill-dashboard-v2-desktop.png
output/playwright/skill-dashboard-v2-mobile.png
```

v2 verification:

```text
npm run build
npx playwright screenshot --viewport-size=1746,823 http://127.0.0.1:4180 output\playwright\skill-dashboard-v2-desktop.png
npx playwright screenshot --viewport-size=390,844 http://127.0.0.1:4180 output\playwright\skill-dashboard-v2-mobile.png
```

v3 verification (scripted Playwright checks against `http://127.0.0.1:4180`):

- Historical v3 check: `108` nodes, `132` edges, `1` selected node.
- Current default selected skill: none.
- `visibleIcons: 0` by default; icon opacity becomes `1` on hover.
- `8` labels visible by default (sparse label budget).
- Depth spread: node radius `3.4–7.7`, node opacity `0.15–0.95`.
- Drag rotates the sphere (node transforms change), inertia carries after release.
- Wheel zoom changes the sphere radius (`232 → 251` on one notch).
- Real mouse click on a node updates the Skill Activation panel.
- Searching `github` narrows the sphere to `13` nodes.
- Build passes: `npm run build` (103 skills generated in the latest build).

v3 screenshots:

```text
output/playwright/skill-dashboard-v3-desktop.png   (1746x823)
output/playwright/skill-dashboard-v3-focus.png     (Focus lens)
output/playwright/skill-dashboard-v3-mobile.png    (390x844)
```

## Known Notes For The Next Chat

- Some `server-*.log` files may exist if background static servers are still running. They are ignored by Git.
- `dist/` is generated output and ignored.
- `node_modules/` is installed locally and ignored.
- The app currently uses real generated skill data, not hardcoded demo data.
- If the skill inventory changes, run `npm run generate:skills` or `npm run build`.
- Keep the graph node icon behavior: default hidden, hover/focus visible.
- Default graph lens is `Web`; `Topics`/sphere is the glass globe lens. Use
  `Focus` when testing selected-skill relationship behavior.
- A static server from an earlier session may already be listening on 4181.
  That is fine: `serve-dist.mjs` reads `dist/` from disk per request with
  `no-store`, so a rebuild is served immediately without restarting it.
