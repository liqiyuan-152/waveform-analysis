# Architecture

Waveform Analysis uses a functional architecture around Vue Composition API. Vue composables own
reactive orchestration and DOM resources, while pure functions own stateless calculations and
state transitions.

## Boundaries

- `useWaveformChartController` is the facade for the chart. It composes composables and exposes the
  existing reactive controller surface; it owns no independent copy of component props.
- `useWaveformViewport` keeps refs, computed values, pointer events, DOM capture, D3 coordinates,
  and emitted events. `transitionViewportInteraction` and `reduceViewportInteraction` are pure
  reducer functions for the legal `begin`, `move`, `finish`, `cancel`, and `reset` transitions.
  The composable's `selection` shallow ref is the only interaction state source; SVG overlays and
  pointer capture remain DOM resources local to the composable.
- `RenderablePointSelectionStrategy` is a function type defining the replaceable rendering
  algorithm boundary. `completePointSelectionStrategy` preserves the complete visible source range
  and `peakPreservingPointSelectionStrategy` preserves first/minimum/maximum/last points per
  bucket. `resolveRenderablePointSelectionStrategy` selects the function from rendering options.
  The existing `selectRenderablePoints` function remains the compatibility facade used by rendering.
- `normalizeWaveformData` and `normalizeWaveformSeries` are functional adapters from public data
  shapes to the internal series model. `buildTrackLayouts` remains a functional builder because
  layout construction is a stateless calculation, not a long-lived object.

## Vue Integration

The viewport `selection` is stored in a shallow ref and updated only with reducer transitions. SVG
overlay elements remain in the composable as DOM resources. Presentation mode, annotation editing,
scales, domains, ticks, formatting, and other stateless calculations stay in their existing
computed/composable or function boundaries.

## Constraints

Do not create classes solely to wrap Composition API refs, props, lifecycle hooks, D3 selections, or
pure mathematical helpers. Do not add strategy factories, inheritance trees, global event buses,
service locators, or duplicate prop state. Keep pure algorithms and reducer transitions as
side-effect-free functions with isolated tests.
