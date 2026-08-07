# Architecture

Waveform Analysis uses a hybrid architecture. Vue Composition API remains the orchestration
boundary, while classes are reserved for domain objects with lifecycle or algorithm-selection
invariants.

## Boundaries

- `useWaveformChartController` is the facade for the chart. It composes composables and exposes the
  existing reactive controller surface; it owns no independent copy of component props.
- `useWaveformViewport` keeps refs, computed values, pointer events, DOM capture, D3 coordinates,
  and emitted events. `ViewportInteractionStateMachine` is its domain collaborator: it has no Vue
  or DOM dependency and accepts only legal `begin`, `move`, `finish`, `cancel`, and `reset`
  transitions. Its state is a `box`/`pan` discriminated union, with `null` representing idle.
- `RenderablePointSelectionStrategy` defines the replaceable rendering algorithm boundary.
  `CompletePointSelectionStrategy` preserves the complete visible source range and
  `PeakPreservingPointSelectionStrategy` preserves first/minimum/maximum/last points per bucket.
  `resolveRenderablePointSelectionStrategy` resolves and reuses the strategy from rendering options. The
  existing `selectRenderablePoints` function remains the compatibility facade used by rendering.
- `normalizeWaveformData` and `normalizeWaveformSeries` are functional adapters from public data
  shapes to the internal series model. `buildTrackLayouts` remains a functional builder because
  layout construction is a stateless calculation, not a long-lived object.

## Vue Integration

The state-machine instance is stored in `shallowRef(markRaw(...))`. Vue receives defensive state
snapshots through a shallow ref, while SVG overlay elements remain in the composable as DOM
resources. Presentation mode, annotation editing, scales, domains, ticks, formatting, and other
stateless calculations stay in their existing computed/composable or function boundaries.

## Constraints

Do not create classes solely to wrap Composition API refs, props, lifecycle hooks, D3 selections, or
pure mathematical helpers. Do not add inheritance trees, global event buses, service locators, or
duplicate prop state. A new class must own a real invariant or replaceable algorithm and must be
used by a production path with isolated tests.
