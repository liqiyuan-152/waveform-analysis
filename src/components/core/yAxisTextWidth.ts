import { YAxisTextMeasurer } from '../../layout/YAxisTextMeasurer'

const measurer = new YAxisTextMeasurer()

export function measureYAxisTextWidth(text: string): number {
  return measurer.measure(text)
}
