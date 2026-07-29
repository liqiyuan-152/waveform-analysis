import type {
  WaveformAnnotation,
  WaveformAxesOptions,
  WaveformData,
  WaveformDisplayMode,
  WaveformFrameStyle,
  WaveformGridTrackLines,
  WaveformInteractionMode,
  WaveformLegendOrientation,
  WaveformLegendPosition,
  WaveformLineStyle,
  WaveformOverlayMode,
  WaveformTitleOptions,
  WaveformZeroLineOptions,
  WaveformZoomEndPayload,
} from '../components'

interface SelectOption<T> {
  label: string
  value: T
}

export interface DemoControlPanelModel {
  controlsOpen: boolean
  displayMode: WaveformDisplayMode
  overlayMode: WaveformOverlayMode
  showTooltip: boolean
  cleanView: boolean
  presentationMode: boolean
  selectedSeriesId: string
  selectedLineStyle: WaveformLineStyle
  lineStyleOptions: Array<SelectOption<WaveformLineStyle>>
  seriesStyleOptions: Array<SelectOption<string>>
  zeroLineVisible: boolean
  zeroLineColor: string
  zeroLineWidth: number
  zeroLineDash: string
  zeroLineDashOptions: Array<SelectOption<string>>
  rowCount: number
  columnCount: number
  horizontalGridVisible: boolean
  horizontalGridColor: string
  verticalGridVisible: boolean
  verticalGridColor: string
  xAxisLineVisible: boolean
  yAxisLineVisible: boolean
  frameBorderColor: string
  frameBackgroundColor: string
  frameBorderWidth: number
  frameBorderStyle: NonNullable<WaveformFrameStyle['borderStyle']>
  frameBorderStyleOptions: Array<SelectOption<string>>
  frameWatermarkVisible: boolean
  titleVisible: boolean
  titleText: string
  titleAlign: NonNullable<WaveformTitleOptions['align']>
  titleAlignOptions: Array<SelectOption<NonNullable<WaveformTitleOptions['align']>>>
  titleFontFamily: string
  titleFontFamilyOptions: Array<SelectOption<string>>
  titleFontSize: number
  titleBold: boolean
  titleItalic: boolean
  titleUnderline: boolean
  titleRotation: number
  titleColor: string
  legendPosition: WaveformLegendPosition
  legendPositionOptions: Array<SelectOption<WaveformLegendPosition>>
  legendOrientation: WaveformLegendOrientation
  legendOrientationOptions: Array<SelectOption<WaveformLegendOrientation>>
  legendBackgroundColor: string
  closeControls: () => void
  resetTitleTextStyle: () => void
  resetWaveformViewport: () => void
}

export interface DemoChartModel {
  data: WaveformData
  minZoomSpan?: number
  initialXDomain?: [number, number]
  displayMode: WaveformDisplayMode
  overlayMode: WaveformOverlayMode
  rowCount: number
  columnCount: number
  gridTrackLines: WaveformGridTrackLines
  title: WaveformTitleOptions
  legendPosition: WaveformLegendPosition
  legendOrientation: WaveformLegendOrientation
  legendBackgroundColor: string
  frameStyle: WaveformFrameStyle
  axes: WaveformAxesOptions
  cleanView: boolean
  presentationMode: boolean
  showTooltip: boolean
  zeroLine: WaveformZeroLineOptions
  frameWatermarkVisible: boolean
  annotations: WaveformAnnotation[]
  annotationsVisible: boolean
  interactionMode: WaveformInteractionMode
  hiddenSeriesIds: string[]
  handleZoomEnd: (payload: WaveformZoomEndPayload) => void | Promise<void>
  resetWaveformViewport: () => void
}
