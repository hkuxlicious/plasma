# Skill Dashboard Project Brief

Last updated: 2026-07-06

## Working Idea

Skill Dashboard is a local-first visual dashboard for understanding, exploring, and activating installed Codex skills.

The first user is the project owner. The larger open-source opportunity is a dashboard that helps AI power users see what skills they have, which ones they actually use, which ones they forgot, and which workflows are emerging from their own toolkit.

The project should feel like an Obsidian-style knowledge graph for skills, but its real job is not decoration. Its real job is skill activation.

## Product Thesis

People install many skills, plugins, agents, and workflow helpers, then forget what they have. A graph can make the collection feel alive, but the dashboard becomes useful only when it answers practical questions:

- What skills do I have?
- What are they for?
- When should I use each one?
- Which skills are related?
- Which skills are unused, stale, duplicated, or overlapping?
- What workflow should I try next?
- Which skills are personal, system, or plugin-provided?
- Which categories are overbuilt or missing?

The dashboard should help the user move from "I downloaded a lot of skills" to "I know what I can do with this toolkit today."

## Current Stack And Constraints

From `DEVELOPMENT_HANDOFF.md`:

- Frontend: React 19 + Vite 7.
- UI code: `src/App.jsx` plus workspace components under `src/components/`.
- Styling: `src/styles.css`.
- Icons: `lucide-react`.
- Data source: generated local JSON at `src/data/generated/skills.generated.json`
  (ignored by git).
- Generator: `scripts/generate-skills.mjs`, scanning local `SKILL.md` files.
- Build command: `npm run build`, which regenerates skills before building.
- Reliable static verification path: `npm run serve -- 4181`.

Current generated inventory:

- Total skills: 103 in the latest local build.
- Default selected skill: none. Explore starts unselected on purpose.
- Current default graph is the `Web` plasma force graph.
- Current sphere/globe experience is available through the Topics/sphere lens.
- Current edges/filaments are relationship-driven and explainable; plasma is
  the approved visual language.

Current information architecture:

- `Explore`: graph, guidance, search, token footprint, selected skill
  workbench.
- `Audit`: Library Snapshot, Constellations/category balance, cold skills,
  heavy token footprint, overlaps, and weak/stale skill health.
- `Workflows`: mission planner, suggested skill chain, and starter bundles.

Important existing UX constraint:

- Graph node icons should stay hidden by default.
- Icons appear on hover or focus.
- Nodes should remain readable as connected dots unless actively inspected.

## Target User

Primary:

- A Codex power user who has many installed skills and wants to understand their toolkit.

Secondary:

- Open-source users who install skills or plugins but do not have a good way to browse, audit, and activate them.
- Skill authors who want to see how their skills fit into a broader local ecosystem.

## Core Jobs To Be Done

1. Inventory
   Show the complete local skill library with source, category, plugin, tags, path, and parsed capabilities.

2. Understand
   Explain what a selected skill does in plain language, when to use it, what it pairs with, and what problems it solves.

3. Activate
   Suggest useful next actions, example prompts, likely workflows, and related skills.

4. Discover
   Surface unused, forgotten, stale, overlapping, and high-potential skills.

5. Map
   Visualize categories, sources, plugins, and workflow relationships in a lively graph that can be explored naturally.

## Design Direction

Keep the dark technical dashboard mood, but make the content more useful and less decorative.

The current V.A.U.L.T. HUD style is visually strong, but some panels currently describe the system instead of helping the user make decisions. The next iteration should keep the atmosphere while replacing filler telemetry with actionable insight.

Design principles:

- Local-first and personal.
- Dense enough for power users, but not noisy.
- Graph-first, but not graph-only.
- Every metric should answer a user question.
- Every relationship line should have a reason.
- Motion should make the graph feel alive, not distract.
- The selected skill should become a small "activation page," not just metadata.

## Main UX Problem In Current Version

The center graph looks like a constellation, but it does not yet feel like Obsidian Graph.

Observed issues:

- Nodes are placed by deterministic radial math, so the graph feels fixed rather than alive.
- The center selection dominates, but surrounding relationships are not always meaningful.
- Lines do not clearly explain why two skills are connected.
- Category grouping exists in data, but the visual grouping is weak.
- The graph interaction feels more like a static diagram than a living map.
- Right-panel content is mostly metadata, not enough guidance.
- Left-panel metrics are visually cool but not yet decision-useful.

## Graph Experience Goal

The graph should feel like a living skill map.

Desired behavior:

- Physics-based floating layout inspired by Obsidian Graph.
- Nodes gently drift and settle rather than sitting in rigid rings.
- User can pan, zoom, drag nodes, hover nodes, select nodes, and reset view.
- Selected node becomes a focus point, but related nodes should arrange around it intelligently.
- Category clusters should be visible.
- Source type should remain visible through color or shape.
- Icons remain hidden by default and reveal on hover or focus.
- Labels should appear based on zoom, selection, hover, search, and importance.
- Edges should have types and tooltips, not just visual lines.
- Users should be able to switch layouts:
  - All skills
  - By category
  - By source
  - By plugin
  - Related to selected
  - Unused or forgotten

Implementation direction:

- Consider replacing the deterministic SVG layout with a force simulation.
- Candidate approaches:
  - `d3-force` inside React with SVG or canvas rendering.
  - A purpose-built force graph library if it fits the app size and styling.
- Keep performance in mind because skill counts may grow past 100.

## Smarter Relationship Model

Current related scoring is useful as a first pass, but the dashboard needs explainable relationships.

Relationship types to model:

- Same category.
- Same source.
- Same plugin.
- Shared tags.
- Shared trigger phrases from descriptions.
- Similar capability text.
- Similar file structure or skill family.
- Skill references another skill, tool, provider, or framework.
- Used together in the same workflow.
- Used in the same project.
- Frequently selected together in dashboard sessions.

Each edge should eventually have:

- Type.
- Strength.
- Reason label.
- Confidence.
- Optional evidence snippet.

Example edge reasons:

- "Both are Research skills."
- "Both come from the Vercel plugin."
- "Both mention browser verification."
- "Often used together after frontend changes."
- "This skill supports the selected workflow."

## Information Architecture

The current three-zone layout is good, but the content should change.

### Left Rail: Library Intelligence

Replace generic system vitals with actionable summaries.

Potential modules:

- Inventory summary:
  - Total skills.
  - Personal skills.
  - Plugin skills.
  - System skills.

- Activation health:
  - Skills never used.
  - Skills used recently.
  - Skills not inspected yet.
  - Duplicate or overlapping areas.

- Category map:
  - Top categories by count.
  - Thin categories with only one or two skills.
  - Overloaded categories that may need grouping.

- Opportunities:
  - "You have many frontend skills. Try grouping them into workflows."
  - "You have research skills but no recent usage."
  - "These personal skills may be worth documenting better."

### Center Stage: Skill Graph

Make this the primary thinking surface.

Modes:

- Constellation: organic force layout.
- Category clusters: grouped by category.
- Source map: personal, system, plugin regions.
- Workflow lens: selected skill plus likely companion skills.
- Forgotten lens: installed but unused or rarely opened.

Core interactions:

- Hover: reveal icon, label, and quick reason.
- Click: open selected skill detail.
- Drag: reposition node.
- Double-click: pin or focus node.
- Search: highlight matches while dimming non-matches.
- Filter: rebuild or reheat graph smoothly.
- Zoom: label density changes with zoom.

### Right Rail: Skill Activation Panel

The right panel should help the user decide what to do with the selected skill.

Suggested structure:

1. Skill identity
   Name, source, category, plugin, path.

2. What it does
   A plain-language summary from parsed `SKILL.md`.

3. When to use it
   Trigger conditions and example situations.

4. Try it
   Example user prompts or tasks that should invoke the skill.

5. Related workflows
   Companion skills and why they connect.

6. Skill health
   Last updated, usage count when available, metadata completeness, missing fields.

7. Raw details
   Collapsible metadata, capabilities, tags, and path.

### Bottom Or Secondary Panel: Exploration Queue

Instead of only showing a giant total number, the dashboard can expose a small action queue:

- Skills to try next.
- Stale skills to review.
- New skills since last scan.
- Skills with weak metadata.
- Suggested workflow bundles.

## Content Model

Existing fields from generated data:

- `id`
- `name`
- `displayName`
- `qualifiedName`
- `description`
- `category`
- `source`
- `plugin`
- `tags`
- `capabilities`
- `path`
- `updatedAt`

Useful derived fields to add later:

- `summary`
- `whenToUse`
- `examplePrompts`
- `workflowRoles`
- `relationshipReasons`
- `usageCount`
- `lastUsedAt`
- `lastViewedAt`
- `isUnused`
- `isStale`
- `metadataCompleteness`
- `family`
- `provider`
- `toolDependencies`

## Open Source Direction

The open-source version should not assume one person's exact Codex setup forever.

Potential positioning:

- "An Obsidian-style skill graph for Codex power users."
- "A local dashboard for discovering and activating installed AI skills."
- "A personal operating map for skills, plugins, agents, and workflows."

Possible future features:

- Import from local skill folders.
- Configurable skill roots.
- Optional usage telemetry stored locally.
- Export graph data as JSON.
- Markdown reports.
- Skill quality checks.
- Skill recommendation engine.
- Workflow bundle builder.

Privacy posture:

- Local-first by default.
- No cloud sync required.
- Usage data should be opt-in and stored locally.
- Paths can be copied, but sensitive filesystem details should not be exposed by default in public exports.

## MVP For Next Build Pass

Highest-value next changes:

1. Create a more Obsidian-like graph interaction.
   Move from fixed radial positioning to physics-based floating layout with drag, pan, zoom, clustering, and smooth reheating.

2. Add category grouping.
   Make clusters legible through spatial grouping, subtle hulls or region labels, and filter modes.

3. Make relationships explainable.
   Add edge reasons and stronger selected-skill relationship scoring.

4. Rework right-panel content.
   Change from metadata-first to activation-first:
   - What it does.
   - When to use.
   - Try this.
   - Related workflows.
   - Raw metadata.

5. Rework left-panel content.
   Replace decorative telemetry with library intelligence:
   - Forgotten skills.
   - Category distribution.
   - Personal vs plugin balance.
   - Metadata health.

6. Preserve visual identity.
   Keep dark technical mood, cyan/mint/amber source language, and hover-only graph icons.

## Non-Goals For The Next Pass

- Do not build account systems.
- Do not add cloud sync.
- Do not add paid/team features.
- Do not rewrite the app in another framework.
- Do not overbuild analytics before local usage tracking exists.
- Do not make the graph beautiful at the cost of usefulness.

## Success Criteria

The next version is successful if the user can open the dashboard and quickly answer:

- What skills do I have?
- Which category is this skill part of?
- Why is this skill connected to those skills?
- What should I use this selected skill for?
- Which skills have I ignored?
- Which skill should I try next?

The graph should feel alive, but the dashboard should make the user feel more capable.
