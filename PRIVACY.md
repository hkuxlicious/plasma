# Privacy

Plasma is local-first. It has no backend service and does not send skill or usage data to a cloud endpoint.

## What The Default Scan Reads

The default generation flow reads installed Codex-style skill files:

```text
CODEX_HOME/skills
CODEX_HOME/skills/.system
CODEX_HOME/plugins/cache
```

It parses `SKILL.md` metadata and descriptions to build the dashboard inventory.

If `PLASMA_AGENT_SKILL_ROOTS` is set, Plasma also reads the labeled `SKILL.md` folders listed there. Those folders are local paths that you control.

## What The Optional Usage Scan Reads

Usage scanning is opt-in. It runs only when you use:

```bash
npm run generate:local
```

or:

```bash
SKILL_DASHBOARD_SCAN_USAGE=1 npm run generate:usage
```

The usage scanner currently reads local Codex session JSONL files under:

```text
CODEX_HOME/sessions
```

It looks for two signals:

- `SKILL.md` files loaded by the agent
- `$skill-name` tags in user messages

It records aggregate counts only:

- reads
- sessions
- first invocation time
- last invocation time

## Generated Files

Generated local data is written to:

```text
src/data/generated/
```

That directory is ignored by git. It can contain local paths and local skill inventory details, so it should not be committed to a public repository.

## Token Footprint Estimates

Plasma estimates `SKILL.md` load size locally. These are estimates, not provider billing numbers. Session-level token metadata may exist in agent logs, but Plasma does not currently attribute true model token usage to individual skills.

## Network

Plasma does not need network access after dependencies are installed.
