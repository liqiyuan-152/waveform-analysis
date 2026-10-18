// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Waveform } from '../../../src/display/index'

const charts: Waveform[] = []
function create(target: string | HTMLElement, options = {}) {
  const chart = new Waveform(target, [{ x: 0, y: 1 }], options)
  charts.push(chart)
  return chart
}
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('target resolution and ownership', () => {
  it('binds the first selector match and preserves host SVG/content through update and destruction', () => {
    document.body.innerHTML =
      '<div class="chart"><svg id="host"><text>HOST</text></svg><p>Keep</p></div><div class="chart"></div>'
    const host = document.querySelector<HTMLElement>('.chart')!
    const chart = create('.chart')
    const owned = host.querySelectorAll('svg')[1]
    host.className = 'renamed'
    chart.updateOptions({ title: { visible: true, text: 'OWNED' } })
    expect(host.querySelectorAll('svg')[1]).toBe(owned)
    expect(chart.toSVGString()).toContain('OWNED')
    expect(chart.toSVGString()).not.toContain('HOST')
    expect(Waveform.getInstanceByDom(host)).toBe(chart)
    expect(Waveform.getInstanceByDom('.chart')).toBeUndefined()
    chart.destroy()
    chart.destroy()
    expect(host.innerHTML).toBe('<svg id="host"><text>HOST</text></svg><p>Keep</p>')
    expect(Waveform.getInstanceByDom(host)).toBeUndefined()
    expect(chart.toSVGString()).toBe('')
    expect(() => chart.downloadSVG()).not.toThrow()
    for (const operation of [
      () => chart.updateData([]),
      () => chart.updateOptions({}),
      () => chart.render(),
      () => chart.resize(),
      () => chart.getOptions(),
    ]) {
      expect(operation).toThrow('destroyed')
    }
  })

  it('reuses init without overriding options and rejects direct duplicate construction', () => {
    const host = document.createElement('div')
    const chart = create(host, { title: { text: 'original' } })
    expect(Waveform.init(host, [], { title: { text: 'ignored' } })).toBe(chart)
    expect(chart.getOptions().title?.text).toBe('original')
    expect(() => create(host)).toThrow('active instance')
    chart.destroy()
    const replacement = Waveform.init(host)
    charts.push(replacement)
    expect(replacement).not.toBe(chart)
  })

  it('rejects invalid targets without touching the document', () => {
    for (const target of [
      '',
      '[',
      '#missing',
      null,
      undefined,
      {},
      document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    ]) {
      const before = document.body.innerHTML
      expect(() => create(target as HTMLElement)).toThrow()
      expect(document.body.innerHTML).toBe(before)
    }
  })

  it('allows unmatched queries but rejects malformed query inputs', () => {
    expect(Waveform.getInstanceByDom('#missing')).toBeUndefined()
    expect(() => Waveform.getInstanceByDom('[')).toThrow('Invalid')
    expect(() => Waveform.getInstanceByDom(null as unknown as HTMLElement)).toThrow()
  })

  it('uses another same-origin window and cleans its observer', () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const realm = iframe.contentWindow!
    const observe = vi.fn(),
      disconnect = vi.fn()
    const callbacks: Array<() => void> = []
    Object.defineProperty(realm, 'ResizeObserver', {
      configurable: true,
      value: class {
        constructor(callback: () => void) {
          callbacks.push(callback)
        }
        observe = observe
        disconnect = disconnect
      },
    })
    const host = realm.document.createElement('div')
    realm.document.body.append(host)
    const chart = create(host)
    expect(observe).toHaveBeenCalledWith(host)
    expect(chart.toSVGString()).toContain('<svg')
    chart.destroy()
    expect(disconnect).toHaveBeenCalledTimes(1)
    callbacks[0]()
    expect(host.children).toHaveLength(0)
  })

  it('cleans failed construction and queued notifications and allows retry', async () => {
    const host = document.createElement('div')
    host.innerHTML = '<span>Keep</span>'
    const notify = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          throw new Error('observe failure')
        }
        disconnect = disconnect
      },
    )
    expect(() => create(host, { onLayoutChange: notify })).toThrow('observe failure')
    await Promise.resolve()
    expect(notify).not.toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(host.innerHTML).toBe('<span>Keep</span>')
    expect(Waveform.getInstanceByDom(host)).toBeUndefined()
    vi.unstubAllGlobals()
    expect(create(host)).toBeInstanceOf(Waveform)
  })
})

it('destroys only one instance and leaves another interactive', () => {
  const first = document.createElement('div'),
    second = document.createElement('div')
  const a = create(first),
    b = create(second)
  a.destroy()
  b.updateData([
    { x: 0, y: 2 },
    { x: 1, y: 5 },
  ])
  expect(second.querySelector('svg')).not.toBeNull()
  expect(b.toSVGString()).toContain('5')
  expect(first.children).toHaveLength(0)
})
