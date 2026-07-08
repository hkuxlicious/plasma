# Contributing

Thanks for helping make Plasma better. The project is in beta, so small, focused improvements are especially useful.

## Local Setup

```bash
npm install
npm run dev
```

Vite prints the local URL, usually:

```text
http://127.0.0.1:5173/
```

## Before Opening A Pull Request

Run the production build:

```bash
npm run build
```

If your change affects the generated skill inventory, test both default and local usage scans:

```bash
npm run generate
npm run generate:local
```

## Privacy And Generated Data

Plasma is local-first. Please do not commit local generated output, personal skill inventory, session summaries, screenshots containing private paths, or environment files.

These paths should stay untracked:

```text
src/data/generated/
dist/
output/
.env
.env.*
```

`.env.example` is the only environment file intended for the repository.

## Pull Request Guidelines

- Keep changes focused and explain the user-facing impact.
- Prefer the existing React, Vite, and CSS patterns before adding new dependencies.
- Include screenshots or short screen recordings for visible UI changes.
- Update `README.md` or `PRIVACY.md` when behavior, setup, or data access changes.

