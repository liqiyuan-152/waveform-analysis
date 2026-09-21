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
- `WorkerSamplingRepository` owns an instance-local Worker dataset store. Its source point copy is
  immutable after registration; viewport sampling can only replace SVG line geometry, never the
  complete point arrays that drive domains, nearest-point lookup, tooltip, annotations, or events.
- `MultiResolutionSamplingIndex` accelerates the Worker's JavaScript fallback. The Rust/WASM
  dataset store implements the same lazy Min/Max and Sum/Count pyramid behind releasable handles.
  Arbitrary visible-range edges are decomposed into exact aligned blocks, so a viewport boundary
  never includes an adjacent bucket.
- `SamplingOutputCache` is a bounded per-repository LRU. Its cache key is revisioned and includes
  visible source indexes plus rendering dimensions; replacement and disposal release both cached
  outputs and index layers.
- The component-side latest-task scheduler allows one in-flight sampling task and retains only the
  newest pending viewport. This bounds Worker queue growth during wheel, pan, and resize bursts.
- Library builds emit the module Worker as a package asset and inline the WASM payload into that
  runtime. Consumers do not copy a separate `.wasm` file, but their CSP must permit the module
  Worker, its `data:` WASM resource, and WebAssembly compilation. Unsupported policies are handled
  through the documented JavaScript fallback or forced-WASM error path, not during module import.
- The Rust source of the numeric core lives in `wasm/src/lib.rs`, with its reproducible toolchain
  metadata in `wasm/Cargo.toml` and `wasm/Cargo.lock`. Generated `wasm/pkg` bindings and
  `wasm/target` compiler output are rebuilt by `pnpm build:wasm` and are not source-controlled.

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

The Worker repository is intentionally an exception to the no-class rule: it owns explicit,
releasable state across asynchronous requests. It is instance-local rather than a global singleton,
and exposes internal resource metrics only for tests and operational diagnostics.
