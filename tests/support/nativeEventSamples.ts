import type { WaveformChartEvents } from '@/types/native'
import type { WaveformControlState } from '@/types/controls'

/** Typed tuples exercise both argument identity and multi-argument Vue forwarding. */
export function nativeEventSamples(state: WaveformControlState): WaveformChartEvents {
  const annotation = { id: 'note', seriesId: 'series-0', x: 0.5, y: 0.5, text: '标注' }
  return {
    'update:interactionMode': ['pan'],
    'interaction-mode-change': ['pan'],
    'control-state-change': [state],
    'point-hover': [{ x: 0.5, y: 0.5 }],
    'zoom-intent': [
      {
        start: 0.2,
        end: 0.8,
        gesture: 'command',
        commandId: 'probe',
        source: 'api',
        action: 'zoom-in',
      },
    ],
    'zoom-change': [[0.2, 0.8]],
    'zoom-end': [
      {
        start: 0.2,
        end: 0.8,
        yRanges: { 'series-0': [0, 1] },
        seriesIds: ['series-0'],
        gesture: 'command',
      },
    ],
    'pan-end': [{ start: 0.2, end: 0.8, trackIndex: 0, seriesIds: ['series-0'] }],
    'zoom-reset': [{ trackIndex: 0, seriesIds: ['series-0'] }],
    'update:annotations': [[annotation]],
    'update:hidden-series-ids': [['series-0']],
    'series-visibility-change': [
      { seriesId: 'series-0', visible: false, hiddenSeriesIds: ['series-0'] },
    ],
    'annotation-create': [annotation],
    'annotation-update': [{ ...annotation, text: '新标注' }, annotation],
    'annotation-delete': [annotation],
    'page-change': [2, 5],
    'sampling-complete': [
      {
        seriesId: 'series-0',
        datasetId: 'probe',
        mode: 'raw',
        selectedMode: 'raw',
        backend: 'javascript',
        strategy: 'none',
        sourcePointCount: 100,
        visiblePointCount: 50,
        renderedPointCount: 50,
        durationMs: 1,
        cacheHit: false,
        requestId: 1,
        revision: 1,
        rawPointLimitExceeded: false,
        scheduledRequestCount: 1,
        coalescedRequestCount: 0,
        maxPendingRequestCount: 1,
      },
    ],
    'sampling-backend-change': [{ seriesId: 'series-0', previous: 'wasm', current: 'javascript' }],
    'sampling-error': [
      { message: 'Worker failed', mode: 'wasm', fallback: 'javascript', seriesIds: ['series-0'] },
    ],
    rendered: [{ revision: 10 }],
    finished: [{ revision: 10 }],
  }
}
