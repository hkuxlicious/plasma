# Improvements Log — for Codex

This file tells the next agent (Codex) what was improved in the v4 pass, why,
where the code lives, and what to build next. Read `PROJECT_BRIEF.md` for
product intent and `DEVELOPMENT_HANDOFF.md` for the full technical handoff.

Last updated: 2026-07-06 (workspace tabs + open-source readiness).

Environment gotcha for the next agent: the Vite dev server's file watcher is
unreliable in this sandboxed Windows setup — after editing files, HMR and
even full reloads can serve stale transforms. If a change doesn't appear in
the browser, restart the dev server before debugging your code.

## Latest update: workspace tabs and open-source checkpoint

Committed locally as `0c3e8d5` (`Refine dashboard workspaces for open source`).

- Header labels are real tabs now: `Explore`, `Audit`, and `Workflows`.
- Explore opens with no selected skill. This is intentional; do not restore
  `deep-research` as a default selected skill.
- `Library Snapshot` and `Constellations` moved out of Explore and into
  Audit.
- Audit now owns cold skills, heavy token footprint, overlap/health, snapshot,
  and category balance.
- Workflows owns the mission planner, suggested chain, and starter bundles.
- Generated runtime data moved to ignored `src/data/generated/`.
- `README.md`, `PRIVACY.md`, `LICENSE`, and `.env.example` were added for
  open-source readiness.
- Latest verified local URL: `http://127.0.0.1:4181/`.
- Protect the center graph/plasma/glass sphere. The user explicitly loves that
  visual and does not want it changed without asking.

## What was improved in v4

### 1. Topical, scored categorization (generator)

File: `scripts/generate-skills.mjs`

- Categories were previously first-regex-match wins, and provider names
  (Vercel, GitHub, Gmail) were treated as categories. Result: 75 of 108
  skills sat in three clusters, gmail skills were labeled "Security",
  `imagegen` was labeled "Games".
- Now every `CATEGORY_RULES` entry is scored: keyword hit in the skill name
  = 4 points, in the description = 1 point, explicit `pluginHints` = 5.
  Highest score wins; earlier rules win ties (specific topics sit above
  broad ones). Plugins are never categories — provider identity lives only
  in `plugin`/`source`.
- Do NOT re-add keyword matching against the plugin name: it biased all 47
  vercel skills toward whichever category mentioned "vercel". That is what
  `pluginHints` is for.
- Runner-up categories with score >= 3 are kept as `secondaryCategories`
  (used for cross-domain relationship reasons and tags).
- Current distribution (102 skills): Deploy & Infra 22, Frontend 13,
  Security 11, AI & Media 10, Games & 3D 9, Code & Repos 8, Browser & QA 7,
  Documents 7, Data & Payments 6, Email 3, Research 3, Skill Ops 3.

### 2. Duplicate plugin versions deduped (generator)

- Multiple cached versions of a plugin produced duplicate skills
  (gh-fix-ci x2, gmail x2, ...). Dedupe key is `source|plugin|name`,
  keeping the newest version (semver compare, mtime fallback).
  108 -> 102 skills.

### 3. Activation content derived at generation time (generator)

- The client used to reverse-engineer meaning from the one-line description
  and served canned per-category prompts. The generator holds the full
  SKILL.md, so it now emits per skill: `summary`, `whenToUse`,
  `examplePrompts` (+ `derivedPromptsAreFallback`), `tokens` (for
  similarity), `completeness`, `secondaryCategories`.
- Prompt extraction patterns, in order: enumerated lists "(i) ... (ii) ...",
  quoted trigger phrases, comma-separated verb phrases after "use when the
  user asks to ...", bulleted/quoted lines under example/trigger headings in
  the body. ~80/102 skills get real prompts; the rest fall back to category
  templates.
- Frontmatter parser handles CRLF and multi-line YAML values. Gotcha: the
  closing `---` is located via `"\n---"`, so on CRLF files every line must be
  stripped of a trailing `\r` before the key/value regex runs (this exact
  bug silently dropped descriptions).
- Skill ids are now `slugify(source-plugin-name)` — stable and free of
  filesystem paths.

### 4. App split into modules (was one 1,745-line file)

- `src/App.jsx` — thin shell: state + composition only.
- `src/constants.js` — SOURCE_ACCENTS, CATEGORY_COLORS, CATEGORY_ICONS,
  GRAPH_MODES.
- `src/lib/sphere.js` — 3D math, lens layouts (`computeBaseVectors` returns
  `{ map, anchors }`), edge builder, cluster label anchors.
- `src/lib/relationships.js` — explainable scoring; uses generator `tokens`
  via a WeakMap Set cache, never re-tokenizes.
- `src/lib/usage.js` — localStorage view tracking (`skill-dashboard-usage`).
- `src/lib/utils.js` — hashing, formatting, search matching.
- `src/components/` — Header, LeftRail, CenterStage, SphereGraph,
  CommandDeck (contains SelectedSkill), Footer.

### 5. Behavior fixes

- Views are recorded only via `selectSkill()` (deliberate clicks). Initial
  default selection and automatic fallback when filters change do NOT count
  as views — keep it that way or the Unseen metric and Forgotten lens rot.
- Graph layout no longer rebuilds on every view-count change: the Forgotten
  lens depends on a memoized unseen-id set keyed by membership (`unseenKey`
  in App.jsx).
- Same-plugin relationship bonus only applies when both skills have
  `source === "Plugin"`. Personal skills all share plugin "user" — they are
  not a family.
- `@vitejs/plugin-react` was in dependencies but never wired into
  `vite.config.js`; JSX silently used the classic transform. It is wired now
  (automatic JSX runtime + fast refresh). New JSX files do not need
  `import React`.

### 6. New graph features

- "Plugins" lens: spherical caps per providing plugin, plugin-mesh edges.
- Cluster region labels on the sphere for Topics/Plugins/Source lenses
  (front-facing, depth-faded; `.cluster-label` in styles.css).
- Right panel is activation-first, driven by generator fields, with
  per-prompt copy feedback.

### Verification notes

- `npm run build` passes (regenerates data first).
- Browser-verified via dev server: 102 nodes, all lenses render, cluster
  labels correct, usage writes exactly 1 view per deliberate click, no
  console errors.
- The preview screenshot tooling times out on the glow-filtered SVG; verify
  via DOM assertions (node counts, label text) instead of screenshots.

## 7. DONE in v4.1: Obsidian-style force-directed "Web" lens

From `PROJECT_BRIEF.md` MVP item 1 ("physics-based floating layout with
drag, pan, zoom, clustering, and smooth reheating"). Implemented and
browser-verified.

- `d3-force` powers the simulation only; rendering stays custom SVG so the
  visual language matches the sphere exactly (same node/edge/label classes).
- Files: `src/lib/force.js` (edge building, category anchors, seeding) and
  `src/components/ForceGraph.jsx`. `CenterStage` renders it when
  `graphMode === "web"`; all sphere lenses are untouched.
- "Web" is the first tab and the default lens.
- Edges: each skill links to its top-2 relationships by
  `relationshipBetween` score (O(n^2), memoized per visible set — ~148 edges
  at 102 skills). Every edge carries a human-readable reason in a `<title>`
  tooltip. Edges touching the selected skill render highlighted.
- Forces: link (distance/strength by score), many-body charge (capped
  `distanceMax` 320), collide, and weak per-category forceX/forceY anchors on
  an ellipse ring so clusters stay legible. Category labels float at live
  cluster centroids.
- Interactions: drag node (fx/fy while dragging, `alphaTarget` reheat),
  double-click (or "p" key) pins/unpins a node (dashed `.pinned-ring`), drag
  background pans, wheel zooms around the viewport centre (0.45–3x),
  click selects, hover reveals icon + label (icons stay hidden by default —
  hard UX constraint). Controls: center selected / zoom / reheat (Flame) /
  reset (also unpins all).
- Filter/search changes rebuild the simulation but survivors keep their
  cached positions (`posCacheRef`), so the layout reheats instead of
  exploding. Pins survive filter changes when the node is still visible.
- `prefers-reduced-motion`: simulation is pre-ticked 220 steps and rendered
  static.
- Verified: 102 nodes / 148 edges render, cluster labels correct, reheat
  moves nodes, zoom transform applies, category filter narrows to the right
  subset and restores, sphere lenses unaffected, production build passes.

## 8. DONE in v4.2: task-first Mission bar

The direct answer to "suggest skills for me". A prominent input above the
graph toolbar: describe the task ("redesign a landing page and verify it in
the browser") and get ranked skill suggestions with reasons, a suggested
workflow chain, and live graph highlighting.

- `src/lib/mission.js` — pure lexical scoring, fully local, no LLM. Signals
  in priority order: real trigger prompt match (quotes the prompt as the
  reason), name match, when-to-use fit, shared generator tokens, category
  mention, tag hits. This works because the generator already extracts real
  trigger phrases — the mission bar is the payoff of that work.
- Suggested chain: best match per workflow stage (Plan & research → Build &
  execute → Verify & review), stages mapped from categories
  (`STAGE_BY_CATEGORY`). Only shown when >= 2 stages have matches.
- `src/components/MissionBar.jsx`, rendered at the top of CenterStage
  (`.constellation-stage` grid gained a row).
- While a mission is active, both graphs dim non-matching nodes
  (`highlightIds` prop on ForceGraph/SphereGraph) and force labels onto the
  matches — type a task and the constellation lights up.
- Client tokenizer (`tokenize` in `src/lib/utils.js`) keeps 2-letter+ words
  ("ui", "pdf", "css") that the generator's stricter tokenizer drops; the
  no-results state explicitly says "this may be a gap in your library".

## 9. DONE in v4.2: Overlap advisor

Skill pairs that likely compete for the same triggers, in the left rail.

- `src/lib/overlap.js` — two signals, thresholds tuned against the real
  library: same normalized name across different sources/plugins ("likely
  duplicates"), and overlap coefficient (|intersection| / |smaller token
  set|) >= 0.4 ("overlapping scope"). Jaccard was tried first and is too
  strict on the capped 48-token sets — keep the overlap coefficient.
- Same-plugin siblings are skipped by design: a plugin's own family shares
  vocabulary intentionally (codex-security's scan suite is not a conflict).
- Real findings on this library: personal `pdf` vs `pdf:pdf` (70% shared),
  `react-best-practices` x2, `shadcn` x2, and `stripe-best-practices` vs
  `vercel:payments` (53% — different names, same scope).
- Rendered in `LeftRail.jsx` as clickable pairs (each name selects that
  skill via `onExplore({ skillId })`).

## Suggestion features — full thinking record (2026-07-03)

The owner's insight: the dashboard already surfaces skills they never use;
can it also *suggest* skills? "Suggest" decomposes into three questions:

1. "What should I use right now?" → task-first matching. SHIPPED as the
   Mission bar (see 8).
2. "Why do I never use these?" → three distinct causes needing different
   fixes: (a) didn't know it existed — dashboard already solves; (b) trigger
   phrases don't match how the user actually phrases requests — needs
   trigger-gap analysis (below); (c) genuinely not needed — right suggestion
   is pruning, partially served by the Overlap advisor (see 9).
3. "What's missing or redundant?" → Overlap advisor SHIPPED for redundancy;
   gap detection (thin categories vs actual usage) still open.

Key feasibility finding, verified on this machine: Codex keeps local session
data under `~/.codex` — a `sessions/` directory (63 files at time of
checking), `session_index.jsonl` (thread ids + names), and a large
`logs_2.sqlite` (~254 MB). Real skill-invocation history is therefore
extractable locally. Format not yet reverse-engineered — that is the spike.

Ideas deliberately parked (in rough priority):

- Trigger-gap analysis (needs usage spike): compare the user's actual prompt
  phrasings from history against skill trigger phrases → "you asked for X
  N times; skill Y never fired — its description doesn't match your
  phrasing." Doubles as SKILL.md authoring feedback.
- Pairing suggestions from session co-occurrence: "sessions using playwright
  usually also invoke verification — never combined by you."
- Skill of the day: rotate one unseen skill into a spotlight with its real
  prompts; converts discovery into a habit.
- One-click launch: generate the exact Codex invocation ready to paste
  (today prompts are copy-only).
- Marketplace gap scan (opt-in, crosses local-first): compare library
  against the plugin registry for thin categories.
- Strategic caution recorded: exhaust local data before adding
  infrastructure (accounts, cloud, embeddings) — nearly everything above
  works on data already on disk.

## 10. DONE in v5: usage-from-sessions → real invocation counts

`scripts/scan-usage.mjs` (read-only) scans `~/.codex/sessions/**/*.jsonl`
rollout files only when explicitly opted into with `npm run generate:local`
or `SKILL_DASHBOARD_SCAN_USAGE=1`. It writes ignored runtime data to
`src/data/generated/usage.generated.json`. Findings that the next agent
should not have to rediscover:

- Session format: JSONL records `{ timestamp, type, payload }` with types
  session_meta / turn_context / event_msg / response_item / compacted.
- Invocation signal 1: Codex loads a skill by READING ITS SKILL.md via a
  shell command — any function_call / custom_tool_call whose arguments
  contain a SKILL.md path under `~/.codex` is an invocation. Plugin cache
  paths embed a version hash: identity is `plugin|folder`, which survives
  version churn (`classifySkillPath`).
- Invocation signal 2: `$name` tags in user messages matched against
  installed skill names.
- Counting: `sessions` (distinct sessions using the skill) is the honest
  number; `reads` is raw. The 254 MB logs_2.sqlite was NOT needed.
- Real numbers on this machine: 35 of 103 skills ever invoked; 68 cold.
  Top: playwright (19 sessions), control-in-app-browser (16),
  frontend-testing-debugging (9). Uninstalled skills show up as unmatched
  and are correctly excluded.
- `npm run generate` = skills plus empty-or-preserved usage data.
  `npm run generate:local` = skills plus local session usage scan.
- Heat model (`computeHeat` in src/lib/usage.js): 0 when never invoked, else
  log-scaled frequency (65%) blended with ~45-day recency decay (35%).
- Dashboard integration: "Cold"/"Hot" metrics, Forgotten lens and
  Expeditions read invocations (not dashboard views), selected-skill panel
  shows "Invoked N×" with sessions/loads/recency tooltip. localStorage views
  remain only as a "viewed here" footnote.

## 13. DONE in v5.3: local skill token footprint

Open-source feature idea: help users understand which skills are lightweight,
heavy, frequently used, or worth trimming without sending any data away from
their machine.

Important distinction:

- Existing `skill.tokens` are keyword tokens for skill matching and overlap
  comparison. They are not LLM cost tokens.
- Existing usage telemetry counts sessions and raw SKILL.md reads from local
  Codex session logs. It does not currently include true model token spend.
- New token-footprint data should start as an estimate: SKILL.md text token
  count, prompt/context footprint per load, and estimated footprint =
  token size x reads.

Implementation:

- `scripts/generate-skills.mjs` now emits `skillSizeTokens`,
  `skillLineCount`, `skillWordCount`, and `skillTokenMethod:
  "local-estimate"` for every skill, plus total skill-size token counts by
  source/category.
- `src/lib/usage.js` combines generated skill token estimates with real
  local read counts from `src/data/generated/usage.generated.json` as
  `estimatedFootprintTokens`.
- `CommandDeck.jsx` shows selected-skill Load and Footprint in the compact
  meta strip, a Token footprint metric block, and a ranked top-7 Token
  Footprint comparison panel.
- Browser verification on `http://127.0.0.1:4181/`: 103 graph nodes, plasma
  canvas still present, no console errors, and the current library footprint
  reads about 1.7M estimated load tokens.

Product framing:

- Local-only and opt-in for anything reading session logs.
- Clearly label estimates vs. measured values.
- Show it as a practical maintenance signal: "heavy and hot", "heavy but
  cold", "tiny but useful", "duplicate expensive skills".
- Good open-source value because users can prune, merge, or improve their own
  skill libraries without needing cloud analytics.

## 11. DONE in v5: plasma renderer (canvas underlay on Web lens)

The design exploration below was approved and shipped. Implementation:

- `src/lib/plasma.js` — paint primitives (hexToRgb, drawGlow, drawFilament,
  drawStrike), Canvas 2D + "lighter" additive compositing, zero deps.
- ForceGraph hosts a `.plasma-canvas` underlay below the SVG node layer. A
  dedicated rAF paint loop reads the live simulation refs (nodesRef,
  linksRef, viewRef) — React never re-renders for plasma frames.
- Canvas/SVG alignment is derived from `svg.getScreenCTM()` every frame, so
  pan/zoom/resize stay pixel-exact with zero bookkeeping.
- Data encoding (the discipline rule, enforced): glow radius+alpha = heat;
  hot (>0.55) gets a white core; cold skills get NO glow — the contrast IS
  the message. Filament brightness = relationship strength + endpoint heat;
  selection energizes its filaments with crackle jitter. Strikes: selection
  = discharge arcs to companions; mission = lightning from the sky to each
  match (keyed on match membership so keystrokes don't restrike).
- SVG node radius also grows slightly with heat; node tooltips state
  "invoked in N sessions" / "never invoked".
- Zap button in graph controls toggles plasma; prefers-reduced-motion
  freezes time (static filaments, no strikes, no pulse).
- Verified: canvas paints (pixel sampling), toggle clears to zero, mission
  strikes fire, playwright renders visibly hot, production build passes.

## 12. DONE in v5.1–v5.2: product renamed to "Plasma", glass globe, aurora

Owner-directed final polish, all shipped and browser-verified:

- Product renamed "Plasma" (was "Codex Skill Universe"): header brand (violet
  glow), index.html title, footer "Plasma Core: Live", aria labels.
- Plasma-globe sphere: tendrils arc from a pulsing magenta core to skills.
  A tendril only reaches a skill with real usage (brightness = heat);
  selection = the strong white arc ("touching the glass"); mission matches
  get cyan-struck tendrils.
- ONE link language: the straight SVG edge lines are gone whenever plasma is
  on — node-to-node relationships render as canvas filaments in BOTH lenses
  (sphere `drawTendril`/`drawFilament` per edge kind, web filaments bumped
  brighter since they're now the only links). SVG lines return only as the
  plasma-off (Zap) fallback, which also preserves edge-reason tooltips.
- Tendril branches were REMOVED from the sphere: stray sparks ending in
  empty space read as noise ("every line must land on a skill"). The branch
  option still exists in `drawTendril` but nothing calls it.
- Apple-glass shell: no colored atmosphere, no interior haze — a whisper of
  white rim (opacity ~0.07), faint silhouette (0.11), shell rings nearly
  off, two crisp specular ellipses.
- Aurora layer (what reveals the glass): POLAR-LIGHT CURTAINS, not blobs —
  `drawAuroraCurtain` in src/lib/plasma.js hangs ~56 vertical rays from a
  two-octave undulating baseline: bright short base segment + faint
  full-length tip, slight slant, subtle per-ray shimmer, pooled glow along
  the band. Waves are computed from normalized position t, so the look is
  resolution-independent. Two curtains inside the sphere clip: main
  mint→violet (canonical aurora green-to-purple, also the product palette)
  in the upper hemisphere, dimmer magenta counter-curtain below drifting the
  opposite way for parallax. Plus ionized blooms hovering over skills with
  heat > 0.4 (bloom size scales with heat). Reduced-motion freezes all of it
  (time = 0).
- Verification gotchas (BOTH bit us; check these before suspecting the code):
  1. Sampling the canvas immediately after a lens switch can race the
     resize (width change clears content) and read all-zero.
  2. HIDDEN PREVIEW TABS PAUSE requestAnimationFrame ENTIRELY
     (document.hidden === true) — every plasma loop freezes, canvases stay
     at their default 300x150 size, and effects look "dead" with zero
     console errors. Taking a screenshot makes the tab visible and resumes
     rAF. Check `document.visibilityState` FIRST when canvas output reads
     blank in the preview.

## Design exploration (recorded 2026-07-03, APPROVED and shipped as v5): plasma visual

Owner's observation: the 3D sphere is attractive but derivative — Obsidian's
graph works because the presentation IS the organizing idea. What
presentation is native to *skills* specifically?

Concept: skills are stored potential energy, not content — so the right
metaphor is plasma/energy, not a knowledge network:

- Unused skills = cold gas: dim, drifting at the periphery.
- Frequently used = hot/ionized: glowing, orbiting near the core.
- Selecting = discharge arc to the skill and its companions (plasma globe).
- Mission bar = lightning strike to all matches (highlighting logic exists).

Discipline rule to keep it honest (brief: "not beautiful at the cost of
useful"): every effect must name its data — heat = invocation count,
distance = recency, filament brightness = relationship strength. No data,
no effect. Calm by default; energy on interaction; static under
prefers-reduced-motion.

Architecture (cheap to try, reversible):

- Layout and paint are separable. Keep the d3-force simulation and the SVG
  node layer (interaction/a11y/labels) exactly as-is.
- Add a <canvas> underlay: additive-blended glow fields per node, animated
  noise-perturbed filaments along the same edge list, discharge arcs.
  Canvas 2D + "lighter" compositing, zero new dependencies — also avoids the
  SVG-filter performance problems already observed.
- Ship as a lens variant ("Plasma" next to "Web") first.

Sequencing: do the usage-from-sessions spike FIRST — the heat channel must
mean real invocations or the metaphor lies on day one.

## Next step (planned): trigger-gap analysis + pairing suggestions

Both are now unlocked by the usage scanner (see 10):

- Trigger-gap: extract the user's actual prompt phrasings from session
  user messages, compare against trigger phrases of skills that did NOT get
  invoked in those sessions → "you asked for X N times; skill Y never fired
  — its description doesn't match your phrasing." Doubles as SKILL.md
  authoring feedback for the owner's own skills.
- Pairing: co-occurrence of skills within the same session (scan-usage
  already tracks per-session sets — extend it to emit pairs) → "sessions
  using playwright usually also invoke verification; you've never combined
  them." Surface in the right panel and as plasma filaments.

## After that: workflow bundles

Named groups of skills (e.g. "frontend change" = ui-ux-pro-max + playwright
+ verification) stored locally (localStorage first, exportable JSON later),
shown as chips on the selected-skill panel and as a graph lens that lays a
bundle out as a pipeline. This is PROJECT_BRIEF "workflow bundle builder" and
makes the dashboard actively prescriptive, not just descriptive.

Suggested shape:

- `src/lib/bundles.js` — CRUD over localStorage key `skill-dashboard-bundles`
  (`{ id, name, skillIds, note, createdAt }`).
- "Add to bundle" action on the selected-skill panel.
- A "Bundles" section in the left rail (list, click to highlight members in
  the current lens, dim the rest).
- Optional later: bundle lens that chains members left-to-right with reason
  labels.

## Later roadmap (in priority order)

1. Local usage telemetry beyond views (skill invoked from prompts, copy
   events) — still local-first, opt-in.
2. Export: graph data as JSON, library report as Markdown.
3. Configurable skill roots (`CODEX_HOME` already respected; allow extra
   roots) for the open-source audience.
4. Skill quality checks surfaced per skill (missing description, no
   examples, stale mtime) — data already exists via `completeness`.
