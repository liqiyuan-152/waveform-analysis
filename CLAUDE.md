# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vue 3 + TypeScript + D3.js waveform visualization component library designed to replace Plotly.js with better performance for large datasets (10,000+ points). The main deliverable is a reusable `WaveformChart` component with waveform rendering, zoom, tooltip, and controlled point annotations.

## Common Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Start Vite dev server
pnpm typecheck        # Run TypeScript type checking
pnpm lint             # Run ESLint (fails on warnings)
pnpm format           # Format code with Prettier
pnpm test             # Run Vitest unit tests
pnpm build            # Build for production (type-check + build)
pnpm preview          # Preview production build
```

## Architecture

### Core Component Structure

The project centers on `WaveformChart.vue` which provides:

1. **Data flexibility**: Accepts either:
   - Sample arrays with sample rate: `{ kind: 'samples', values: number[], sampleRate: number }`
   - Explicit points: `{ kind: 'points', points: { x, y }[] }`
   - Multi-series data: `{ kind: 'series', series: WaveformSeries[] }`

2. **Interactions**:
   - Zoom and pan when `zoomable` is enabled
   - Hover nearest data points and show tooltip details
   - Add, edit, delete, hide and show point annotations

3. **Display modes** (via `display-mode` prop):
   - `independent` - Each series on its own Y-axis
   - `separated` - Series stacked vertically
   - `compact` - All series on shared Y-axis

### Data Normalization Flow

All input data flows through `normalizeWaveformData()` and `normalizeWaveformSeries()` in [waveform.ts](src/components/waveform.ts):

- Converts samples+sampleRate to `{ x, y }` points
- Filters out non-finite values
- Sorts points by X coordinate
- Assigns stable series IDs (use explicit `id` in multi-channel data)

### Multi-Series Coordination

For multi-channel waveforms, each `WaveformSeries` should have a stable `id` property. Time
coordinates always use seconds; the `timeUnit` prop only affects display labels.

Annotations are chart-local and parent-controlled through `v-model:annotations`. They bind to
`seriesId` plus `x/y` data coordinates; business fields such as frame keys and shot numbers do
not belong in the reusable component.
Right-clicking anywhere in the plot opens the creation editor and anchors the annotation to the
corresponding data position with a connector line; existing annotations keep their edit/delete context menu.
Y-axis ticks use one shared scientific exponent when the axis magnitude is below `0.01` or at
least `100`. Tooltips use localized plain values, while annotation X follows the selected time
unit and annotation Y uses full plain decimal text. Raw numeric values remain unchanged.

## Key Design Decisions

1. **Performance**: D3.js enables rendering 100k+ points smoothly. Component uses Vue's `shallowRef` for D3 instances to avoid deep reactivity overhead.

2. **Time units**: Internal coordinates are always in seconds. The `timeUnit` prop only controls axis label formatting.

3. **Annotation state**: The chart never mutates annotation input arrays. CRUD operations emit
   new arrays and lifecycle events; persistence remains the responsibility of the parent.

4. **Chinese documentation**: Primary documentation is in `doc/` folder in Chinese, covering project planning, API design, and integration guides.

## File Organization

- `src/components/WaveformChart.vue` - Main component
- `src/components/waveform.ts` - Type definitions and data normalization
- `src/components/annotation/` - Annotation rendering and interaction components
- `src/components/index.ts` - Public API exports
- `src/App.vue` - Demo application
- `doc/*.md` - Comprehensive Chinese documentation

## Testing

Tests are in [WaveformChart.test.ts](src/components/WaveformChart.test.ts) using Vitest + @vue/test-utils. Test setup is in [src/test/setup.ts](src/test/setup.ts).

When adding features, verify:

- Data normalization handles edge cases (empty arrays, NaN values, negative sample rates)
- Multi-series with duplicate IDs get auto-generated unique IDs
