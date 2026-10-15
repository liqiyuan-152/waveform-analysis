import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import { pendingAnimationFrameCount } from '../support/setup'

const charts: WaveformChartInstance[] = []
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.dispose())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function fixture() {
  const iframe = document.createElement('iframe')
  document.body.append(iframe)
  const owner = iframe.contentWindow!
  const host = owner.document.createElement('div')
  owner.document.body.append(host)
  vi.spyOn(host, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  const frames = new Map<number, FrameRequestCallback>()
  let sequence = 0,
    time = 0
  vi.spyOn(owner.performance, 'now').mockImplementation(() => time)
  vi.spyOn(owner.document, 'hidden', 'get').mockReturnValue(false)
  vi.spyOn(owner, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++sequence
    frames.set(id, callback)
    return id
  })
  const cancel = vi.spyOn(owner, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  const addVisibility = vi.spyOn(owner.document, 'addEventListener')
  const removeVisibility = vi.spyOn(owner.document, 'removeEventListener')
  const media = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  Object.defineProperty(owner, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => media),
  })
  const chart = init(
    host,
    {
      width: 800,
      height: 400,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      animation: { duration: 1000, easing: 'linear' },
      rendering: { sampling: { mode: 'raw' } },
    },
    { autoResize: false },
  )
  charts.push(chart)
  return {
    owner,
    host,
    frames,
    cancel,
    media,
    chart,
    addVisibility,
    removeVisibility,
    async frame(ms = 0) {
      time += ms
      for (let i = 0; i < 4; i++) {
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach((callback) => callback(time))
        await Promise.resolve()
      }
    },
  }
}

describe('native animation owner-window resources', () => {
  it('uses only the host clock/frames and ignores visibility changes in the parent document', async () => {
    const h = fixture()
    const finished = vi.fn()
    h.chart.on('finished', finished)
    await h.frame()
    const initial = Number(
      h.host.querySelector('.waveform-chart__series clipPath rect')?.getAttribute('width'),
    )
    expect(initial).toBe(0)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await h.frame(500)
    const rect = h.host.querySelector('.waveform-chart__series clipPath rect')!
    expect(Number(rect.getAttribute('width'))).toBeGreaterThan(0)
    expect(finished).not.toHaveBeenCalled()
    expect(pendingAnimationFrameCount()).toBe(0)
    await h.frame(500)
    expect(finished).toHaveBeenCalledOnce()
    expect(h.frames.size).toBe(0)
  })

  it('releases owner RAF and exact media/visibility listeners when disposed', async () => {
    const h = fixture()
    await h.frame()
    expect(h.frames.size).toBeGreaterThan(0)
    const visibility = h.addVisibility.mock.calls.find(([name]) => name === 'visibilitychange')!
    const media = h.media.addEventListener.mock.calls[0]
    h.chart.dispose()
    expect(h.cancel).toHaveBeenCalled()
    expect(h.frames.size).toBe(0)
    expect(h.media.removeEventListener).toHaveBeenCalledWith(...media)
    expect(h.removeVisibility).toHaveBeenCalledWith(...visibility)
    expect(h.host.childElementCount).toBe(0)
    const requested = h.owner.requestAnimationFrame as unknown as ReturnType<typeof vi.fn>
    const before = requested.mock.calls.length
    const callback = media[1] as (event: MediaQueryListEvent) => void
    callback({ matches: true } as MediaQueryListEvent)
    await h.frame(1000)
    expect(requested.mock.calls.length).toBe(before)
  })
})
