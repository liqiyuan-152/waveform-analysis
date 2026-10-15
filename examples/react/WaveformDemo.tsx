import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  init,
  type WaveformAnnotation,
  type WaveformChartInstance,
  type WaveformData,
  type WaveformInteractionMode,
} from 'waveform-analysis/native'
import { diagnostics } from '../shared/diagnostics'
import { ExampleImageDownload } from '../shared/ExampleImageDownload'

interface Props {
  data: WaveformData
  narrow: boolean
  onRendered: (revision: number) => void
}

/** React owns only the DOM ref and lifecycle; the native instance owns chart state. */
export function WaveformDemo({ data, narrow, onRendered }: Props): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<WaveformChartInstance | null>(null)
  const callback = useRef(onRendered)
  const download = useRef<ExampleImageDownload | null>(null)
  const [annotations, setAnnotations] = useState<WaveformAnnotation[]>([])
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([])
  const [interactionMode, setInteractionMode] = useState<WaveformInteractionMode>('zoom')
  const [exportState, setExportState] = useState({ message: '', busy: false })
  useLayoutEffect(() => {
    callback.current = onRendered
  }, [onRendered])

  useEffect(() => {
    const host = container.current!
    const chart = init(host, {
      animationEnabled: false,
      toolbar: true,
      pannable: true,
      legend: { interactive: true },
      grid: { rowCount: 1, columnCount: 1 },
      annotations: [],
      hiddenSeriesIds: [],
      interactionMode: 'zoom',
    })
    instance.current = chart
    diagnostics.mounted(host)
    const subscriptions = [
      chart.on('rendered', ({ revision }) => callback.current(revision)),
      chart.on('update:annotations', setAnnotations),
      chart.on('update:hidden-series-ids', setHiddenSeriesIds),
      chart.on('update:interactionMode', setInteractionMode),
    ]
    const exporter = new ExampleImageDownload(chart, host.ownerDocument, (message, busy) =>
      setExportState({ message, busy }),
    )
    download.current = exporter
    return () => {
      subscriptions.forEach((cancel) => cancel())
      exporter.dispose()
      download.current = null
      chart.dispose()
      diagnostics.unmounted(chart)
      instance.current = null
    }
  }, [])

  useEffect(() => {
    instance.current?.setOption({ data })
  }, [data])
  // React owns controlled values and explicitly acknowledges replacement-array requests.
  useEffect(() => {
    instance.current?.setOption({ annotations, hiddenSeriesIds, interactionMode })
  }, [annotations, hiddenSeriesIds, interactionMode])
  useEffect(() => {
    instance.current?.resize()
  }, [narrow])
  return (
    <section className="example-chart">
      <div className="example-controls" aria-label="图表操作">
        <button onClick={() => instance.current?.zoomIn()}>放大</button>
        <button onClick={() => instance.current?.zoomOut()}>缩小</button>
        <button onClick={() => instance.current?.resetViewport()}>重置视口</button>
        <button onClick={() => instance.current?.fitToData()}>显示全部</button>
        {(['zoom', 'pan', 'annotation'] as const).map((mode, index) => (
          <button
            key={mode}
            aria-pressed={interactionMode === mode}
            onClick={() => setInteractionMode(mode)}
          >
            {['缩放模式', '平移模式', '标注模式'][index]}
          </button>
        ))}
        <button onClick={() => setHiddenSeriesIds((ids) => (ids.includes('b') ? [] : ['b']))}>
          切换通道 2
        </button>
        <button onClick={() => setAnnotations([])}>清空标注</button>
        {(['svg', 'png'] as const).map((format) => (
          <button
            key={format}
            disabled={exportState.busy}
            onClick={() => void download.current?.save(format)}
          >
            导出 {format.toUpperCase()}
          </button>
        ))}
      </div>
      <p className="example-state" aria-live="polite">
        标注 {annotations.length} 条；隐藏 {hiddenSeriesIds.length} 个通道；模式 {interactionMode}
      </p>
      <p className="example-export-status" role="status">
        {exportState.message}
      </p>
      <div ref={container} className="example-host" style={{ width: narrow ? 360 : '100%' }} />
    </section>
  )
}
