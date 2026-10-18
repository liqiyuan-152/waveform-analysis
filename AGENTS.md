# Repository Guidelines

## Project Overview

This repository is a TypeScript and D3 native SVG waveform library with a Vue 3 adapter.
The published package is `waveform-analysis`; deliberate public exports live in `src/index.ts`,
`src/native.ts`, `src/analysis.ts`, `src/display.ts`, and `src/vue.ts`. The private `demo-app` workspace consumes built package entries
and is not part of the public API.

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

- `src/display/`: independent display component and compatibility adapters; public entry `src/display.ts`.
- `src/shared/`: framework-independent formatting, SVG and animation math used by both components.
- `src/chart/`: instance factory, facade, resources, events and staged update scheduler.
- `src/model/`, `src/data/`: options, viewport, visibility, presentation, prepared data and queries.
- `src/layout/`, `src/view/`, `src/rendering/`: layout measurement, persistent DOM/SVG views and geometry.
- `src/interaction/`, `src/annotation/`, `src/controls/`, `src/export/`: native controllers and exports.
- `src/sampling/`, `src/core/workerSampling/`, `src/wasm/`, `wasm/`: scheduling, transport, repositories,
  generated package glue and Rust sources. Daily commands use checked-in WASM; explicit
  `prepare:wasm` / `build:wasm` and CI validate/rebuild it with the pinned Rust toolchain.
- `src/animation/`: shared animator and framework-independent presentation lifecycle.
- `src/adapters/vue/`: prop snapshots, event forwarding, attachment and Vue component.
- `src/components/`: shared computational helpers, styles and compatibility re-exports; the
  `WaveformChart.vue` here is a compatibility entry, not the native chart orchestrator.
- `src/types/`, `src/utils/`: shared public types and pure helpers; exports remain explicit.
- `demo-app/src/`: private demo app, routes, controls, views and simulated data.
- `tests/`: native/adapters/core regression tests; `tests/fixtures/legacy/` keeps the old Vue engine
  for compatibility comparison only. `demo-app/tests/` covers the demo. `tests/support/` owns mocks.
- `scripts/`: build, package consumer, boundary/license checks and browser evidence tools.
- `docs/` and root Markdown notes: verify historical claims against current source and README.

When `.codegraph/` exists, prefer CodeGraph for unknown code or cross-file call paths. Its output
can be stale: compare its indexed revision/source with current files before relying on it, and use
current targeted file reads/rg when insufficient. Index rebuilds remain the user's decision; do not
rebuild automatically. Read known files directly for local edits.

Tests mirror source ownership. Add focused regression files under the matching native/adapters
folder; do not extend the legacy fixtures into a second production implementation.

## Toolchain and Commands

Use Node.js 22 and pnpm 10.32.1, matching CI. Keep `pnpm-lock.yaml` synchronized with
`package.json` and use the locked install in automation.

```bash
pnpm install --frozen-lockfile # Reproduce the CI dependency graph
pnpm dev                       # Start the Vite demo
pnpm typecheck                 # Run vue-tsc project checks
pnpm check:file-length         # Enforce the 450-line limit under src/
pnpm lint:all                  # Run oxlint and ESLint with zero warnings
pnpm check:native-boundary     # Verify native entry dependency boundary
pnpm check:licenses            # Verify third-party notices
pnpm typecheck:examples        # Verify public examples after declarations
pnpm test                      # Run Vitest once
pnpm test:coverage             # Run tests and enforce coverage thresholds
pnpm build                     # Type-check and build library, declarations, and demo
pnpm test:package              # Pack and test independent ESM/CJS/types/CSS/WASM consumers
pnpm pack                      # Create a tarball; prepack runs the complete build
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

ESLint enforces a maximum of 450 physical lines for files under `src/`; the standalone length
check applies the same limit to all text files below `src/`. Split code by existing ownership
boundaries when a file approaches the limit. Keep rendering, layout, interaction, annotation, and
data concerns in their existing modules rather than adding more orchestration to
`src/chart/WaveformChart.ts`.

Use the `@/` alias for internal `src/` imports where it improves clarity. Keep public exports
explicit: adding a type or helper internally does not make it supported API. When changing a
public prop, event, type, formatter, serialization format, or package export, update `src/index.ts`,
tests, and `README.md` together. Preserve backwards compatibility unless the task explicitly calls
for a breaking change.

Do not hand-edit generated output in `dist/`, `dist-demo/`, `coverage/`, or `.vite/`. Library peers
are externalized by `vite.lib.config.ts`; validate packaging after dependency or export changes.

## Testing Expectations

Vitest projects separate pure algorithm/data/script suites in Node from DOM suites in jsdom.
Only the DOM project uses `@vue/test-utils` and `tests/support/setup.ts`; keep discovery complete
when moving suites between projects. Unified V8 coverage must remain at least 80% for lines,
statements, and functions, and 75% for branches; animation/core has stricter existing thresholds.

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
demo in `dist-demo/`. GitHub CI runs frozen install, explicit WASM preparation, typecheck, length,
lint, native-boundary/license/example gates, coverage, build and independent package consumers.
GitHub and Gitea release verification require the same quality gates before publishing.

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
