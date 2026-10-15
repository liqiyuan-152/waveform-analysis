import { SvgExporter } from '@/export/SvgExporter'
export { copySvgStyles } from '@/export/svgSnapshotStyles'

/** Compatibility path for the legacy Vue exporter. */
export function createChartSnapshot(
  container: HTMLElement,
  source: SVGSVGElement,
  width: number,
  height: number,
  titleHeight: number,
  background?: string,
) {
  return new SvgExporter().serialize(source, background, { container, width, height, titleHeight })
}
