# Repository Guidelines

## Project Overview

This repository is a Vue 3, TypeScript, and D3 waveform component library with a Vite demo.
The published package is `waveform-analysis`; its supported public surface is exported from
`src/index.ts`. The demo is a consumer of that library code, not part of the public API.

Important behavioral contracts:

- Treat waveform input as immutable. Replace the `data` reference to refresh normalization,
  domains, caches, and the viewport; do not rely on in-place array mutation.
- X coordinates are stored in seconds. `timeUnit` and X-axis formatters affect display only and
  must not alter raw coordinates, zoom domains, or emitted event values.
- Give every multi-series waveform a unique, stable `id`. Visibility, annotations, axes, and
  state retention use normalized series IDs.
- Annotations and hidden-series state are controlled by the consumer. Emit replacement arrays;
  persistence belongs to the host application.
- Rendering may downsample visible SVG geometry, but domains, nearest-point lookup, tooltips,
  annotations, and error ranges must continue to use the full normalized data.

## Repository Layout

- `src/index.ts`: deliberate package exports for components, types, core helpers, and utilities.
- `src/components/WaveformChart.vue`: top-level chart composition and public prop/event boundary.
- `src/components/core/`: layout, domains, grids, presentation state, and chart controllers.
- `src/components/data/`: component-facing data types and data-layer exports.
- `src/components/rendering/`: SVG tracks, axes, series, legends, hover layers, and styles.
- `src/components/interaction/`: viewport, zoom, hover, tooltip, and interaction hosts.
- `src/components/annotation/`: annotation types, serialization, editing, layout, and interaction.
- `src/core/`: package-level normalization and rendering/downsampling logic.
- `src/types/`: shared public data and chart types.
- `src/utils/`: domains, formatting, geometry, sampling, and waveform ID helpers.
- `src/demo/`, `src/App.vue`: controls and the main interactive demo workspace.
- `src/router.ts`, `src/DemoRouterApp.vue`, `src/views/`: hash-based demo routes and focused demos.
- `src/data/`: simulated demo data; `src/test/`: shared Vitest setup and test helpers.
- `scripts/`: repository checks and declaration-build cleanup scripts.
- `docs/` and root Markdown notes: supporting or historical documentation; verify claims against
  current source, tests, `README.md`, and `package.json` before relying on them.

Tests are colocated as `*.test.ts`. The large chart suite is split under
`src/components/waveformChartCases/`; add focused cases there instead of rebuilding a monolithic
chart test file.

## Toolchain and Commands

Use Node.js 22 and pnpm 10.32.1, matching CI. Keep `pnpm-lock.yaml` synchronized with
`package.json` and use the locked install in automation.

```bash
pnpm install --frozen-lockfile # Reproduce the CI dependency graph
pnpm dev                       # Start the Vite demo
pnpm typecheck                 # Run vue-tsc project checks
pnpm check:file-length         # Enforce the 400-line limit under src/
pnpm lint                      # Run ESLint with zero warnings allowed
pnpm test                      # Run Vitest once
pnpm test:coverage             # Run tests and enforce coverage thresholds
pnpm build                     # Type-check and build library, declarations, and demo
pnpm pack --dry-run            # Inspect the publishable package contents
pnpm preview                   # Preview dist-demo/
pnpm format                    # Apply the repository Prettier configuration
```

For a narrow change, run the closest test file while iterating, then run the full relevant gates
before handoff. Do not describe a check as passing unless it actually ran.

## Coding and Architecture Conventions

Use Vue 3 Composition API and strict TypeScript. Follow the repository Prettier configuration:
two-space indentation, single quotes, no semicolons, and a 100-column print width. Use PascalCase
for Vue components and types, and camelCase for functions, composables, variables, and props in
TypeScript. Vue template props and events use kebab-case.

ESLint enforces a maximum of 400 physical lines for files under `src/`; the standalone length
check applies the same limit to all text files below `src/`. Split code by existing ownership
boundaries when a file approaches the limit. Keep rendering, layout, interaction, annotation, and
data concerns in their existing modules rather than adding more orchestration to
`WaveformChart.vue`.

Use the `@/` alias for internal `src/` imports where it improves clarity. Keep public exports
explicit: adding a type or helper internally does not make it supported API. When changing a
public prop, event, type, formatter, serialization format, or package export, update `src/index.ts`,
tests, and `README.md` together. Preserve backwards compatibility unless the task explicitly calls
for a breaking change.

Do not hand-edit generated output in `dist/`, `dist-demo/`, `coverage/`, or `.vite/`. Library peers
are externalized by `vite.lib.config.ts`; validate packaging after dependency or export changes.

## Testing Expectations

Vitest runs in jsdom with `@vue/test-utils`; shared setup is in `src/test/setup.ts`. Coverage uses
V8 and must remain at least 80% for lines, statements, and functions, and 75% for branches.

Cover behavior at the narrowest useful layer:

- normalization: empty, invalid, non-finite, unsorted, duplicate-ID, and multi-series inputs;
- layout and domains: display modes, overlays, fixed ranges, pagination, margins, and small sizes;
- formatting: endpoint/tick consistency, time units, scientific notation, and custom formatters;
- rendering: downsampling, styles, points, error bars, axes, grids, legends, and clean view;
- interaction: wheel/box zoom, zoom-out, pan, reset, hover, visibility, and presentation mode;
- annotations: CRUD, serialization validation, drag offsets, reprojection, and hidden series.

Avoid brittle assertions against incidental SVG structure when a user-visible or emitted behavior
can be asserted instead. Add regression coverage for every bug fix.

## Build, CI, and Release

`pnpm build` produces the ESM/CJS library and CSS in `dist/`, declarations in `dist/types/`, and the
demo in `dist-demo/`. GitHub CI runs frozen install, typecheck, file-length checks, lint, coverage,
build, and `pnpm pack --dry-run` on pushes and pull requests.

Use short Conventional Commit-style messages consistent with current history, for example
`feat(chart): support ...`, `fix(annotation): handle ...`, or `test: cover ...`. Keep generated
files, local settings, and unrelated refactors out of commits. Review `git status` and the staged
diff before committing. Pull requests should explain public or user-visible effects, list commands
actually run, link the relevant issue or plan, and include screenshots or a short recording for
visual changes.

Releases are triggered by annotated tags matching `vX.Y.Z` or a semver prerelease such as
`vX.Y.Z-rc.1`. The tag version must exactly match `package.json`. The Gitea workflow validates,
tests, builds, packs, publishes to both configured npm registries, creates checksums and a release,
and deploys the demo only for stable versions. Do not create or push a release tag until the version
commit and full release checks are complete.

## Change Discipline

Keep edits scoped to the request and preserve unrelated worktree changes. Do not commit secrets,
local environment files, IDE state, logs, or registry credentials. For visual behavior changes,
verify both the reusable component and the relevant demo route at representative desktop and small
container sizes; state clearly when browser verification was not performed.
