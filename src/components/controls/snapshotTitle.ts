import { SvgTitleExporter } from '../../export/SvgTitleExporter'

/** Compatibility path; shared SVG title serialization is framework independent. */
export function snapshotTitle(container: HTMLElement, titleHeight: number, width: number) {
  return new SvgTitleExporter().snapshot(container, titleHeight, width)
}
