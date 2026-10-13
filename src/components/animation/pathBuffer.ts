import { line, curveLinear, curveStep, curveStepBefore, curveStepAfter } from 'd3'
import type { ScaleLinear } from 'd3'
import type { WaveformPoint, WaveformLineType } from '@/types'

let decoder: TextDecoder | undefined

/** Stable D3 accessors/context keep their feedback across frames; storage is private to points. */
export function createPathBuffer(x: ScaleLinear<number, number>, y: ScaleLinear<number, number>) {
  let xScale = x,
    yScale = y,
    type: WaveformLineType | undefined
  let bytes = new Uint8Array(1024),
    length = 0
  const append = (text: string) => {
    if (length + text.length > bytes.length) {
      const next = new Uint8Array(Math.max(bytes.length * 2, length + text.length))
      next.set(bytes)
      bytes = next
    }
    for (let i = 0; i < text.length; i++) bytes[length++] = text.charCodeAt(i)
  }
  const coordinate = (value: number) => append(String(Math.round(value * 1000) / 1000))
  const point = (command: string, x: number, y: number) => {
    append(command)
    coordinate(x)
    append(',')
    coordinate(y)
  }
  const generator = line<WaveformPoint>()
    .x((point) => xScale(point.x))
    .y((point) => yScale(point.y))
    .context({
      moveTo: (x: number, y: number) => point('M', x, y),
      lineTo: (x: number, y: number) => point('L', x, y),
      closePath: () => append('Z'),
    } as unknown as CanvasRenderingContext2D)
  return (
    points: WaveformPoint[],
    nextType: WaveformLineType,
    x: ScaleLinear<number, number>,
    y: ScaleLinear<number, number>,
  ): string => {
    xScale = x
    yScale = y
    if (type !== nextType) {
      generator.curve(
        nextType === 'step-start'
          ? curveStepBefore
          : nextType === 'step-middle'
            ? curveStep
            : nextType === 'step-end' || nextType === 'step-after'
              ? curveStepAfter
              : curveLinear,
      )
      type = nextType
    }
    length = 0
    generator(points)
    return (decoder ??= new TextDecoder()).decode(bytes.subarray(0, length))
  }
}
