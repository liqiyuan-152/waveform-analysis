# Repository Guidelines

## Project Structure & Module Organization

This repository is a Vue 3 + TypeScript waveform component library with a Vite demo.
Production exports are defined in `src/index.ts`; demo entry points are `src/main.ts` and
`src/App.vue`. The main chart is `src/components/WaveformChart.vue`, with focused modules under
`src/components/{core,data,rendering,interaction,annotation}`. Shared types live in `src/types`,
data normalization and chart logic in `src/core` and `src/utils`, styles in `src/styles.css`, and
sample data in `src/data`. Tests are colocated with implementation files (`*.test.ts`), with shared
setup in `src/test/setup.ts`. `dist/` and `dist-demo/` are generated; do not edit them.

## Build, Test, and Development Commands

Use pnpm (the lockfile is `pnpm-lock.yaml`) and Node.js 22 as CI does.

```bash
pnpm install                 # Install locked dependencies
pnpm dev                     # Start the Vite demo server
pnpm typecheck               # Run vue-tsc checks
pnpm lint                    # Run ESLint with zero warnings allowed
pnpm test                    # Run Vitest once
pnpm test:coverage           # Run tests and enforce coverage thresholds
pnpm build                   # Type-check and build library plus demo bundles
pnpm preview                 # Preview the production demo build
```

Run `pnpm format` to apply the repository Prettier configuration.

## Coding Style & Naming Conventions

Use TypeScript and Vue 3 Composition API with two-space indentation, single quotes, no semicolons,
and a 100-column print width. Prettier and ESLint are authoritative.
Use PascalCase for Vue components, component filenames, and types; use camelCase for functions,
variables, and composables (for example, `useWaveformData`). Keep public exports deliberate and
preserve stable series IDs for multi-channel data.

## Testing Guidelines

Vitest with `@vue/test-utils` and jsdom is used. Name tests `*.test.ts` beside the
code they cover. Exercise normalization, rendering/layout helpers, formatting, and component
interactions, including empty, non-finite, and multi-series inputs. Coverage thresholds are 80%
for lines/statements/functions and 75% for branches; run `pnpm test:coverage` before submitting.

## Commit & Pull Request Guidelines

The current history contains only `first commit`, so no established convention exists yet. Use short,
imperative messages, preferably scoped (for example, `feat(chart): ...`, `fix(annotation): ...`, or
`test: ...`). Pull requests should explain API or user-visible changes, list verification commands,
link an issue or plan, and include screenshots or a short recording for visual changes. Keep generated
files and unrelated refactors out of the change.

## CI and Configuration

GitHub Actions runs install, typecheck, lint, coverage, build, and `pnpm pack --dry-run` on pushes and
pull requests. Do not commit secrets or local environment files; review the staged file list before
opening a pull request.
