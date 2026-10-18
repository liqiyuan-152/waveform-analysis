// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Select } from 'ant-design-vue'
import { nextTick } from 'vue'
import App from '../../../demo-app/src/display/App.vue'
import ConfigPanel from '../../../demo-app/src/display/components/config-panel/ConfigPanel.vue'
import AnimationPanel from '../../../demo-app/src/display/components/AnimationPanel.vue'
import { seriesFields } from '../../../demo-app/src/display/config/seriesFields'
import { Waveform, type WaveformSeries } from 'waveform-analysis/display'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn())
  document.body.replaceChildren()
})

async function setup() {
  const wrapper = mount(App, { attachTo: document.body })
  await nextTick()
  const host = wrapper.find('.waveform-preview').element as HTMLElement
  const chart = Waveform.getInstanceByDom(host)!
  chart.animation.finish()
  cleanup.push(() => wrapper.unmount())
  const button = async (label: string) => {
    const target = wrapper
      .findAll('[role=tab], .ant-segmented-item, button')
      .find((item) => item.text().replace(/\s/g, '') === label)
    if (!target) throw new Error(`Missing navigation: ${label}`)
    await target.trigger('click')
    await nextTick()
  }
  const field = (label: string) => {
    const target = wrapper
      .findAll('.config-field')
      .find((item) => item.find('.config-field__label').text() === label)
    if (!target) throw new Error(`Missing field: ${label}`)
    return target
  }
  const input = async (label: string, value: string) => {
    await field(label).find('input:not([type=color])').setValue(value)
    await nextTick()
  }
  const toggle = async (label: string) => {
    await field(label).find('[role=switch]').trigger('click')
    await nextTick()
  }
  // Select's emitted value exercises the same handler as the popup selection.
  const select = async (label: string, value: string) => {
    field(label).findComponent(Select).vm.$emit('update:value', value)
    await nextTick()
  }
  const node = (selector: string) => host.querySelector(selector)!
  const attr = (selector: string, name: string) => node(selector).getAttribute(name)
  const lines = () => Array.from(host.querySelectorAll('g[clip-path] path[fill="none"]'))
  return { wrapper, host, chart, button, field, input, toggle, select, node, attr, lines }
}

describe('Demo controls to rendered SVG', () => {
  it('appends to retained data when leaving empty preview, but disables append for no series', async () => {
    const t = await setup()
    const panel = t.wrapper.findComponent(ConfigPanel)
    const state = () => panel.props() as unknown as { series: WaveformSeries[]; empty: boolean }
    const previous = structuredClone(state().series)
    await t.button('文字')
    await t.button('空状态')
    await t.toggle('预览空数据状态')
    t.chart.animation.finish()
    expect(t.lines()).toHaveLength(0)
    await t.button('数据场景')
    const append = () => t.wrapper.findAll('button').find((item) => item.text() === '追加点')!
    expect(append().attributes('disabled')).toBeUndefined()
    await t.button('追加点')
    t.chart.animation.finish()
    expect(state().empty).toBe(false)
    expect(t.lines()).toHaveLength(previous.length)
    state().series.forEach((series, index) => {
      expect(series.data).toHaveLength(previous[index].data.length + 1)
      expect(series.data.slice(0, -1)).toEqual(previous[index].data)
      expect({ ...series, data: [] }).toEqual({ ...previous[index], data: [] })
    })
    panel.vm.$emit('series', [])
    await nextTick()
    t.chart.animation.finish()
    expect(append().attributes('disabled')).toBeDefined()
    const before = t.host.innerHTML
    await t.button('追加点')
    // Guard the handler too, even if a component emits despite its disabled button.
    t.wrapper.findComponent(AnimationPanel).vm.$emit('scenario', 'append')
    await nextTick()
    expect(state().series).toEqual([])
    expect(t.host.innerHTML).toBe(before)
    await t.button('坐标域变化')
    t.chart.animation.finish()
    expect(state().series).toHaveLength(2)
    expect(append().attributes('disabled')).toBeUndefined()
  })

  it('applies responsive aspect ratio and height limits with validation and restoration', async () => {
    const t = await setup()
    await t.input('高度', '480')
    await t.toggle('响应式布局')
    await t.input('宽高比', '2')
    expect(t.attr('svg', 'viewBox')).toBe('0 0 800 400')
    await t.input('最小高度', '500')
    expect(t.attr('svg', 'height')).toBe('500')
    await t.input('最小高度', '1')
    await t.input('最大高度', '300')
    expect(t.attr('svg', 'height')).toBe('300')
    await t.input('最大高度', '1')
    expect(t.attr('svg', 'height')).toBe('1')
    await t.input('最大高度', '300')
    await t.input('宽高比', '0.1')
    expect(t.attr('svg', 'height')).toBe('300')
    for (const label of ['宽高比', '最小高度', '最大高度']) {
      const before = t.host.innerHTML
      await t.input(label, '0')
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(before)
      await t.input(label, '')
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(before)
    }
    await t.input('宽高比', '2.6')
    await t.input('最小高度', '220')
    await t.input('最大高度', '600')
    expect(Number(t.attr('svg', 'height'))).toBeCloseTo(800 / 2.6)
    await t.toggle('响应式布局')
    expect(t.attr('svg', 'height')).toBe('480')
  })

  it('applies exact manual padding on all four sides, rejects negatives and restores auto layout', async () => {
    const t = await setup()
    await t.input('宽度', '900')
    await t.input('高度', '480')
    const natural = t.attr('.waveform-frame-border', 'width')
    await t.toggle('自动留白')
    for (const [label, value] of [
      ['上留白', '40'],
      ['右留白', '50'],
      ['下留白', '60'],
      ['左留白', '70'],
    ])
      await t.input(label, value)
    expect(t.attr('svg > g', 'transform')).toBe('translate(70,40)')
    expect(t.attr('.waveform-frame-border', 'width')).toBe('780')
    expect(t.attr('.waveform-frame-border', 'height')).toBe('380')
    for (const label of ['上留白', '右留白', '下留白', '左留白']) {
      const before = t.host.innerHTML
      await t.input(label, '-1')
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(before)
      await t.input(label, '')
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(before)
      await t.input(label, '0')
    }
    expect(t.attr('svg > g', 'transform')).toBe('translate(0,0)')
    expect(t.attr('.waveform-frame-border', 'width')).toBe('900')
    expect(t.attr('.waveform-frame-border', 'height')).toBe('480')
    await t.input('上留白', '32')
    await t.input('下留白', '62')
    await t.toggle('自动留白')
    expect(t.attr('.waveform-frame-border', 'width')).toBe(natural)
  })

  it('applies fixed dimensions and frame appearance, then restores visibility', async () => {
    const t = await setup()
    await t.input('宽度', '900')
    await t.input('高度', '480')
    expect(t.attr('svg', 'viewBox')).toBe('0 0 900 480')
    expect(t.attr('svg', 'height')).toBe('480')
    await t.button('边框')
    for (const [label, value, selector, attribute] of [
      ['背景颜色', '#123456', '.waveform-frame-background', 'fill'],
      ['边框颜色', '#654321', '.waveform-frame-border', 'stroke'],
      ['边框宽度', '3.5', '.waveform-frame-border', 'stroke-width'],
      ['圆角', '12', '.waveform-frame-border', 'rx'],
    ]) {
      await t.input(label, value)
      expect(t.attr(selector, attribute)).toBe(value)
    }
    await t.select('边框样式', 'dotted')
    expect(t.attr('.waveform-frame-border', 'stroke-linecap')).toBe('round')
    await t.toggle('显示边框')
    expect(t.host.querySelector('.waveform-frame-border')).toBeNull()
    expect(t.host.querySelector('.waveform-frame-background')).toBeNull()
    await t.toggle('显示边框')
    expect(t.attr('.waveform-frame-border', 'stroke')).toBe('#654321')
  })

  it('validates all frame fields, enum candidates and restoration without altering curve geometry', async () => {
    const t = await setup()
    await t.button('边框')
    const curves = () => t.lines().map((line) => line.outerHTML)
    const originalCurves = curves()
    const initial = {
      background: t.attr('.waveform-frame-background', 'fill'),
      border: t.attr('.waveform-frame-border', 'stroke'),
      width: t.attr('.waveform-frame-border', 'stroke-width'),
      radius: t.attr('.waveform-frame-border', 'rx'),
    }
    for (const [label, selector, attribute, original] of [
      ['背景颜色', '.waveform-frame-background', 'fill', initial.background],
      ['边框颜色', '.waveform-frame-border', 'stroke', initial.border],
    ] as const) {
      for (const value of ['#123456', 'rgba(37, 99, 235, 0.5)', 'transparent']) {
        await t.input(label, value)
        expect(t.attr(selector, attribute)).toBe(value)
      }
      for (const value of ['not-a-color', '']) {
        const before = t.host.innerHTML
        await t.input(label, value)
        expect(t.field(label).find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input(label, original!)
      expect(t.attr(selector, attribute)).toBe(original)
      expect(t.field(label).find('[role=alert]').exists()).toBe(false)
    }
    for (const [label, attribute, original] of [
      ['边框宽度', 'stroke-width', initial.width],
      ['圆角', 'rx', initial.radius],
    ] as const) {
      for (const value of ['3.5', '0', '0.25', '1000']) {
        await t.input(label, value)
        expect(t.attr('.waveform-frame-border', attribute)).toBe(value)
        if (attribute === 'rx') expect(t.attr('.waveform-frame-background', 'rx')).toBe(value)
      }
      for (const value of ['-1', '']) {
        const before = t.host.innerHTML
        await t.input(label, value)
        expect(t.field(label).find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input(label, original!)
      expect(t.attr('.waveform-frame-border', attribute)).toBe(original)
      expect(t.field(label).find('[role=alert]').exists()).toBe(false)
    }
    for (const [style, dash, cap] of [
      ['solid', null, null],
      ['dashed', '6 4', null],
      ['dotted', '1 3', 'round'],
      ['solid', null, null],
    ] as const) {
      await t.select('边框样式', style)
      expect(t.attr('.waveform-frame-border', 'stroke-dasharray')).toBe(dash)
      expect(t.attr('.waveform-frame-border', 'stroke-linecap')).toBe(cap)
    }
    expect(curves()).toEqual(originalCurves)
  })

  it('preserves series overrides while global opacity, interpolation and visibility affect all paths', async () => {
    const t = await setup()
    await t.button('线点')
    await t.input('线条颜色', '#123456')
    await t.input('线条宽度', '4.5')
    expect(t.lines().map((line) => line.getAttribute('stroke-width'))).toEqual([
      '1.5',
      '1.5',
      '1.5',
      '1.5',
    ])
    expect(t.lines()[0].getAttribute('stroke')).toBe('#2563eb')
    await t.input('线条透明度', '0.35')
    expect(t.lines().every((line) => line.getAttribute('stroke-opacity') === '0.35')).toBe(true)
    const beforeInvalid = t.host.innerHTML
    for (const [label, value] of [
      ['线条颜色', 'not-a-color'],
      ['线条颜色', ''],
      ['线条宽度', '-1'],
      ['线条宽度', ''],
    ]) {
      await t.input(label, value)
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(beforeInvalid)
    }
    await t.select('线条样式', 'dashed')
    expect(t.lines().every((line) => line.getAttribute('stroke-dasharray'))).toBe(true)
    const linear = t.lines()[0].getAttribute('d')
    for (const type of ['step-start', 'step-middle', 'step-end']) {
      await t.select('连线类型', type)
      expect(t.lines()[0].getAttribute('d')).not.toBe(linear)
    }
    await t.toggle('显示线条')
    expect(t.lines()).toHaveLength(0)
    await t.toggle('显示线条')
    expect(t.lines()).toHaveLength(4)
  })

  it('renders point shape, size, fill and border independently of line visibility', async () => {
    const t = await setup()
    await t.button('线点')
    await t.toggle('显示线条')
    await t.button('数据点')
    await t.toggle('显示数据点')
    const selector = 'g[clip-path] path:not([fill="none"])'
    expect(t.host.querySelectorAll(selector).length).toBeGreaterThan(100)
    for (const [label, value, attribute] of [
      ['数据点颜色', '#112233', 'fill'],
      ['数据点边框', '#445566', 'stroke'],
      ['点边框宽度', '2.5', 'stroke-width'],
    ]) {
      await t.input(label, value)
      expect(t.attr(selector, attribute)).toBe(value)
    }
    const circle = t.attr(selector, 'd')
    for (const type of ['square', 'triangle', 'diamond']) {
      await t.select('数据点形状', type)
      expect(t.attr(selector, 'd')).not.toBe(circle)
    }
    const small = t.attr(selector, 'd')
    await t.input('数据点大小', '6')
    expect(t.attr(selector, 'd')).not.toBe(small)
    const beforeInvalid = t.host.innerHTML
    for (const [label, value] of [
      ['数据点大小', '-1'],
      ['数据点大小', ''],
      ['点边框宽度', '-1'],
      ['点边框宽度', ''],
      ['数据点颜色', 'not-a-color'],
      ['数据点颜色', ''],
    ]) {
      await t.input(label, value)
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(beforeInvalid)
    }
    await t.input('数据点大小', '0')
    expect(
      t
        .attr(selector, 'd')!
        .replace(/[MLZ]/g, '')
        .split(/[, ]+/)
        .filter(Boolean)
        .every((value) => Number(value) === 0),
    ).toBe(true)
    await t.input('数据点大小', '6')
    expect(t.attr(selector, 'd')).not.toBe('M0,0')
    await t.toggle('显示数据点')
    expect(t.host.querySelectorAll(selector)).toHaveLength(0)
  })

  it('validates global line boundaries on inherited series while isolating explicit overrides', async () => {
    const t = await setup()
    await t.button('数据场景')
    await t.button('坐标域变化')
    t.chart.animation.finish()
    // Both scenario series inherit global appearance. The third series deliberately overrides it.
    const points = [
      { id: 'a', x: 0, y: -1 },
      { id: 'b', x: 1, y: 1 },
    ]
    t.chart.update({
      data: [
        { id: 'inherited', data: points },
        { id: 'explicit', data: points, style: { color: '#abcdef', lineWidth: 7, opacity: 0.7 } },
      ],
      options: { animationEnabled: false },
    })
    await t.button('线点')
    const check = (attribute: string, expected: string, peer: string) => {
      expect(t.lines().map((line) => line.getAttribute(attribute))).toEqual([expected, peer])
    }
    for (const color of ['#123456', 'rgba(37, 99, 235, 0.5)', 'transparent', '#2563eb']) {
      await t.input('线条颜色', color)
      check('stroke', color, '#abcdef')
    }
    for (const width of ['3.5', '0', '0.25', '1000', '1.5']) {
      await t.input('线条宽度', width)
      check('stroke-width', width, '7')
    }
    for (const opacity of ['0', '0.25', '1', '0.35']) {
      await t.input('线条透明度', opacity)
      check('stroke-opacity', opacity, '0.7')
    }
    for (const [label, invalids, valid] of [
      ['线条颜色', ['not-a-color', ''], '#2563eb'],
      ['线条宽度', ['-1', 'Infinity', 'NaN', ''], '1.5'],
      ['线条透明度', ['-0.1', '1.1', 'Infinity', 'NaN', ''], '1'],
    ] as const) {
      for (const value of invalids) {
        const before = t.host.innerHTML
        await t.input(label, value)
        expect(t.field(label).find('[role=alert]').exists(), `${label}: ${value}`).toBe(true)
        expect(t.host.innerHTML, `${label}: ${value}`).toBe(before)
      }
      await t.input(label, valid)
      expect(t.field(label).find('[role=alert]').exists()).toBe(false)
    }
    for (const [style, dash] of [
      ['solid', null],
      ['dashed', '8 5'],
      ['dash-dot', '8 4 2 4'],
      ['solid', null],
    ] as const) {
      await t.select('线条样式', style)
      expect(t.lines().every((line) => line.getAttribute('stroke-dasharray') === dash)).toBe(true)
    }
    const original = t.lines().map((line) => line.outerHTML)
    await t.toggle('显示线条')
    expect(t.lines()).toHaveLength(0)
    await t.toggle('显示线条')
    expect(t.lines().map((line) => line.outerHTML)).toEqual(original)
    await t.input('线条透明度', '0.4')
    await t.input('线条透明度', '-0.1')
    await t.input('线条宽度', '2')
    expect(t.chart.getOptions().line?.opacity).toBe(0.4)
    await t.button('坐标轴')
    await t.button('值轴')
    await t.button('单值轴')
    await t.button('多值轴')
    expect(t.chart.getOptions().line?.opacity).toBe(0.4)
    expect(t.lines().every((line) => line.getAttribute('stroke-opacity') === '0.4')).toBe(true)
    await t.button('线点')
    await t.input('线条透明度', '1')
    await t.input('线条宽度', '1.5')
  })

  it('applies X axis domain, formatting, tick styling, titles and endpoint visibility', async () => {
    const t = await setup()
    await t.button('坐标轴')
    await t.select('范围策略', 'data')
    await t.select('刻度策略', 'legacy')
    await t.input('最小值', '0')
    await t.input('最大值', '100')
    await t.input('刻度步长', '20')
    await t.input('数字格式', '.1f')
    expect(t.node('.waveform-axis-x-endpoint--end').textContent).toBe('100.0')
    for (const [label, value, selector, attribute] of [
      ['轴线颜色', '#123456', '.waveform-axis-x .tick line', 'stroke'],
      ['轴线宽度', '2.5', '.waveform-axis-x .tick line', 'stroke-width'],
      ['刻度文字颜色', '#654321', '.waveform-axis-x .tick text', 'fill'],
      ['刻度字号', '18', '.waveform-axis-x .tick text', 'font-size'],
      ['刻度长度', '9', '.waveform-axis-x .tick line', 'y2'],
    ]) {
      await t.input(label, value)
      expect(t.attr(selector, attribute)).toBe(attribute === 'y2' ? '-9' : value)
    }
    await t.input('轴标题', 'Elapsed')
    await t.input('标题单位', 's')
    expect(t.node('.waveform-axis-x-title').textContent).toBe('Elapsed (s)')
    await t.toggle('显示端点值')
    expect(t.host.querySelector('.waveform-axis-x-endpoints')).toBeNull()
    await t.toggle('显示坐标轴')
    expect(t.host.querySelector('.waveform-axis-x')).toBeNull()
    await t.toggle('显示坐标轴')
    expect(t.host.querySelector('.waveform-axis-x')).not.toBeNull()
    await t.input('最小值', '')
    expect(t.chart.getOptions().xAxis?.min).toBeUndefined()
  })

  it('validates X tick geometry and typography boundaries while preserving other axes', async () => {
    const t = await setup()
    t.chart.updateOptions({ animationEnabled: false })
    await t.button('坐标轴')
    await t.select('范围策略', 'data')
    await t.select('刻度策略', 'legacy')
    await t.input('最小值', '0')
    await t.input('最大值', '100')
    await t.input('刻度步长', '20')
    const peer = () =>
      [...t.host.querySelectorAll('.waveform-axis-y')].map((node) => node.outerHTML)
    const originalPeer = peer()
    for (const [label, values, selector, attribute, sign, restore] of [
      ['刻度长度', ['9', '0', '0.25', '1000'], '.waveform-axis-x .tick line', 'y2', -1, '6'],
      ['刻度间距', ['12', '0', '0.25', '1000'], '.waveform-axis-x .tick text', 'y', 1, '6'],
      [
        '轴线宽度',
        ['2.5', '0', '0.25', '1000'],
        '.waveform-axis-x .tick line',
        'stroke-width',
        1,
        '1.3',
      ],
      [
        '刻度字号',
        ['18', '1', '1.25', '1000'],
        '.waveform-axis-x .tick text',
        'font-size',
        1,
        '14',
      ],
    ] as const) {
      for (const value of values) {
        await t.input(label, value)
        const target = t.host.querySelector(selector)
        if (target)
          expect(Number(target.getAttribute(attribute)), `${label}: ${value}`).toBe(
            Number(value) * sign || 0,
          )
        else expect(['刻度间距', '刻度字号']).toContain(label)
        if (label === '刻度间距')
          expect(Number(t.attr('.waveform-axis-x-endpoint--start', 'y'))).toBe(Number(value))
        if (label === '刻度字号')
          expect(t.attr('.waveform-axis-x-endpoints', 'font-size')).toBe(value)
        expect(peer()).toEqual(originalPeer)
      }
      for (const invalid of [
        '-1',
        'NaN',
        'Infinity',
        '',
        ...(label === '刻度字号' ? ['0', '0.5'] : []),
      ]) {
        const before = t.host.innerHTML
        await t.input(label, invalid)
        expect(t.field(label).find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input(label, restore)
      expect(t.field(label).find('[role=alert]').exists()).toBe(false)
    }
    for (const [label, selector, attribute, restore] of [
      ['轴线颜色', '.waveform-axis-x .tick line', 'stroke', '#e2e8f0'],
      ['刻度文字颜色', '.waveform-axis-x .tick text', 'fill', '#78E8FF'],
    ] as const) {
      for (const color of ['#123456', 'rgba(37, 99, 235, 0.5)', 'transparent']) {
        await t.input(label, color)
        expect(t.attr(selector, attribute)).toBe(color)
        if (label === '刻度文字颜色')
          expect(t.attr('.waveform-axis-x-endpoints', 'fill')).toBe(color)
        expect(peer()).toEqual(originalPeer)
      }
      for (const invalid of ['not-a-color', '']) {
        const before = t.host.innerHTML
        await t.input(label, invalid)
        expect(t.field(label).find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input(label, restore)
    }
  })

  it('applies X number formats and units with formatter precedence and valid empty text', async () => {
    const t = await setup()
    t.chart.updateOptions({ animationEnabled: false })
    await t.button('坐标轴')
    await t.select('范围策略', 'data')
    await t.select('刻度策略', 'legacy')
    await t.input('最小值', '0')
    await t.input('最大值', '100')
    await t.input('刻度步长', '20')
    const endpoints = () =>
      [...t.host.querySelectorAll('.waveform-axis-x-endpoint')].map((node) => node.textContent)
    for (const [format, expected] of [
      ['.2f', ['0.00', '100.00']],
      ['.1e', ['0.0e+0', '1.0e+2']],
      ['', ['0', '100']],
    ] as const) {
      await t.input('数字格式', format)
      expect(endpoints()).toEqual(expected)
    }
    for (const unit of ['ms', '微秒 μs', ' ', '长单位'.repeat(40), '']) {
      await t.input('刻度单位', unit)
      expect(endpoints()).toEqual([`0${unit ? ` ${unit}` : ''}`, `100${unit ? ` ${unit}` : ''}`])
      expect(t.field('刻度单位').find('[role=alert]').exists()).toBe(false)
    }
    await t.input('刻度单位', 'ms')
    await t.input('数字格式', '.2f')
    expect(endpoints()).toEqual(['0.00', '100.00'])
    for (const format of ['not-a-format', '..2f']) {
      const before = t.host.innerHTML
      await t.input('数字格式', format)
      expect(t.field('数字格式').find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(before)
    }
    await t.input('数字格式', '')
    expect(endpoints()).toEqual(['0 ms', '100 ms'])
    await t.input('刻度单位', '')
    await t.input('数字格式', '.0f')
    expect(endpoints()).toEqual(['0', '100'])
  })

  it('validates X title text, units, appearance, fitting and offset without losing hidden settings', async () => {
    const t = await setup()
    t.chart.updateOptions({ animationEnabled: false })
    await t.button('坐标轴')
    const title = () => t.host.querySelector('.waveform-axis-x-title')!
    for (const text of ['Elapsed', '时间 Δt', ' ', '很长的轴标题'.repeat(30), '']) {
      await t.input('轴标题', text)
      if (text) expect(title().textContent).toBe(`${text} (ms)`)
      else expect(title()).toBeNull()
      expect(t.field('轴标题').find('[role=alert]').exists()).toBe(false)
    }
    await t.input('轴标题', 'Time')
    for (const unit of ['s', '微秒 μs', ' ', '很长单位'.repeat(30), '']) {
      await t.input('标题单位', unit)
      expect(title().textContent).toBe(`Time${unit ? ` (${unit})` : ''}`)
    }
    await t.input('标题单位', 'ms')
    for (const color of ['#123456', 'rgba(37, 99, 235, 0.5)', 'transparent']) {
      await t.input('标题颜色', color)
      expect(title().getAttribute('fill')).toBe(color)
    }
    for (const weight of ['700', 'bold', 'normal', '', '自定义字重', '很长的无效字重'.repeat(20)]) {
      await t.input('标题字重', weight)
      expect(title().getAttribute('font-weight')).toBe(weight)
    }
    await t.input('标题字重', '500')
    for (const size of ['18', '1', '1.25', '1000']) {
      await t.input('标题字号', size)
      const actual = Number(title().getAttribute('font-size'))
      expect(actual).toBeGreaterThan(0)
      expect(actual).toBeLessThanOrEqual(Number(size))
      if (Number(size) <= 18) expect(actual).toBe(Number(size))
      if (Number(size) === 1000) expect(actual).toBeLessThan(Number(size))
    }
    await t.input('标题字号', '14')
    // Automatic padding can move the frame; measure the title relative to its right edge.
    await t.input('标题偏移', '100')
    const gap100 =
      Number(title().getAttribute('x')) - Number(t.attr('.waveform-frame-border', 'width'))
    await t.input('标题偏移', '120.25')
    const gap120 =
      Number(title().getAttribute('x')) - Number(t.attr('.waveform-frame-border', 'width'))
    expect(gap120 - gap100).toBeCloseTo(20.25, 8)
    await t.input('标题偏移', '0')
    expect(Number.isFinite(Number(title().getAttribute('x')))).toBe(true)
    for (const [label, invalids, restore] of [
      ['标题颜色', ['not-a-color', ''], '#78E8FF'],
      ['标题字号', ['0', '0.5', '-1', 'NaN', 'Infinity', ''], '14'],
      ['标题偏移', ['-1', 'NaN', 'Infinity', ''], '8'],
    ] as const) {
      for (const invalid of invalids) {
        const before = t.host.innerHTML
        await t.input(label, invalid)
        expect(t.field(label).find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input(label, restore)
    }
    const original = title().outerHTML
    await t.toggle('显示轴标题')
    expect(title()).toBeNull()
    await t.toggle('显示轴标题')
    expect(title().outerHTML).toBe(original)
  })

  it('edits left and right axes independently and restores bindings through single-axis mode', async () => {
    const t = await setup()
    await t.button('坐标轴')
    await t.button('值轴')
    const selectAxis = async (value: number) => {
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择值轴')!
        .vm.$emit('update:value', value)
      await nextTick()
    }
    for (const [index, position, color] of [
      [0, 'left', '#123456'],
      [1, 'right', '#654321'],
    ] as const) {
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择值轴')!
        .vm.$emit('update:value', index)
      await nextTick()
      await t.input('轴线颜色', color)
      expect(t.attr(`.waveform-axis-y--${position} .tick line`, 'stroke')).toBe(color)
      await t.input('轴标题', position)
      await t.input('标题单位', 'V')
      expect(t.node(`.waveform-axis-y-title[data-axis-id="${position}"]`).textContent).toBe(
        `${position} (V)`,
      )
    }
    const beforeRanges = t.lines().map((line) => line.getAttribute('d'))
    const firstPointY = (path: string | null) => Number(path?.match(/^M[^,]+,([^L]+)/)?.[1])
    const beforeY = beforeRanges.map(firstPointY)
    await selectAxis(0)
    await t.input('最小值', '-1')
    await t.input('最大值', '1')
    const afterLeftRange = t.lines().map((line) => line.getAttribute('d'))
    const afterLeftY = afterLeftRange.map(firstPointY)
    expect(afterLeftY.slice(0, 2)).not.toEqual(beforeY.slice(0, 2))
    expect(afterLeftY.slice(2)).toEqual(beforeY.slice(2))
    await selectAxis(1)
    await t.input('最小值', '-100')
    await t.input('最大值', '100')
    const afterRightRange = t.lines().map((line) => line.getAttribute('d'))
    const afterRightY = afterRightRange.map(firstPointY)
    expect(afterRightY.slice(0, 2)).toEqual(afterLeftY.slice(0, 2))
    expect(afterRightY.slice(2)).not.toEqual(afterLeftY.slice(2))
    await t.button('单值轴')
    expect(t.host.querySelectorAll('.waveform-axis-y')).toHaveLength(1)
    await t.button('多值轴')
    expect(t.host.querySelectorAll('.waveform-axis-y')).toHaveLength(2)
    expect(t.attr('.waveform-axis-y--right .tick line', 'stroke')).toBe('#654321')
    expect(t.lines()).toHaveLength(4)
  })

  it('uses the domain strategy count only when extending bounds and rejects invalid drafts', async () => {
    const t = await setup()
    t.chart.update({
      data: [
        { x: 1.2, y: -1 },
        { x: 13.2, y: 1 },
      ],
      options: { animationEnabled: false },
    })
    await t.button('坐标轴')
    await t.input('数字格式', '.1f')
    const endpoints = () =>
      [...t.host.querySelectorAll('.waveform-axis-x-endpoint')].map((node) => node.textContent)
    await t.select('范围策略', 'nice')
    await t.input('策略刻度数', '5')
    expect(endpoints()).toEqual(['0.0', '14.0'])
    await t.input('策略刻度数', '10')
    expect(endpoints()).toEqual(['1.0', '14.0'])
    await t.select('范围策略', 'data')
    await t.input('策略刻度数', '5')
    expect(endpoints()).toEqual(['1.2', '13.2'])
    await t.select('范围策略', 'nice')
    await t.select('扩展边界', 'end')
    expect(endpoints()).toEqual(['1.2', '14.0'])
    await t.input('最小值', '1.3')
    await t.input('最大值', '13.1')
    expect(endpoints()).toEqual(['1.3', '13.1'])
    await t.toggle('包含手动范围')
    expect(endpoints()).toEqual(['1.3', '14.0'])
    await t.select('扩展边界', 'both')
    expect(endpoints()).toEqual(['0.0', '14.0'])
    for (const count of ['1', '1.5', '1000']) {
      await t.input('策略刻度数', count)
      expect(t.field('策略刻度数').find('[role=alert]').exists()).toBe(false)
      expect(endpoints().every((text) => Number.isFinite(Number(text)))).toBe(true)
    }
    for (const invalid of ['0', '-1', 'NaN', 'Infinity', '']) {
      const before = t.host.innerHTML
      await t.input('策略刻度数', invalid)
      expect(t.field('策略刻度数').find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(before)
    }
    await t.input('策略刻度数', '10')
    await t.toggle('包含手动范围')
    await t.input('最小值', '')
    await t.input('最大值', '')
    expect(endpoints()).toEqual(['1.0', '14.0'])
  })

  it.each([0, 1])(
    'validates value axis %i bounds, density, strategy and visibility with isolated mapping',
    async (index) => {
      const t = await setup()
      const points = [
        { id: 'a', x: 0, y: 1.3 },
        { id: 'b', x: 1, y: 8.7 },
      ]
      t.chart.update({
        data: [
          { id: 'left-signal', yAxis: 'left', data: points },
          { id: 'right-signal', yAxis: 'right', data: points },
        ],
        options: { animationEnabled: false },
      })
      await t.button('坐标轴')
      await t.button('值轴')
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择值轴')!
        .vm.$emit('update:value', index)
      await nextTick()
      const position = index === 0 ? 'left' : 'right'
      const selector = `.waveform-axis-y--${position}`
      const ticks = () =>
        [...t.host.querySelectorAll(`${selector} .tick`)].map(
          (node) => (node as Element & { __data__: number }).__data__,
        )
      const firstY = (i: number) =>
        Number(
          t
            .lines()
            [i].getAttribute('d')!
            .match(/^M[^,]+,([^L]+)/)![1],
        )
      await t.select('刻度策略', 'legacy')
      await t.input('最小值', '')
      await t.input('最大值', '')
      const peerY = firstY(1 - index)
      await t.input('最小值', '-5')
      await t.input('最大值', '20')
      const height = Number(t.attr('.waveform-frame-border', 'height'))
      expect(firstY(index)).toBeCloseTo((height * (20 - 1.3)) / 25, 3)
      expect(firstY(1 - index)).toBe(peerY)
      await t.input('最小值', '30')
      expect(firstY(index)).toBeCloseTo((height * (20 - 1.3)) / -10, 3)
      await t.input('最小值', '2')
      await t.input('最大值', '2')
      expect(firstY(index)).toBeCloseTo((height * (3 - 1.3)) / 2, 3)
      for (const label of ['最小值', '最大值']) {
        for (const invalid of ['NaN', 'Infinity', 'not-a-number']) {
          const before = t.host.innerHTML
          await t.input(label, invalid)
          expect(t.field(label).find('[role=alert]').exists()).toBe(true)
          expect(t.host.innerHTML).toBe(before)
        }
        await t.input(label, '')
      }
      await t.input('刻度数量', '5')
      await t.select('刻度策略', 'nice')
      expect(ticks()).toEqual([0, 2, 4, 6, 8, 10])
      expect(firstY(index)).toBeCloseTo(height * 0.87, 3)
      await t.input('最小值', '1.3')
      await t.input('最大值', '8.7')
      expect(ticks()).toEqual([2, 4, 6, 8])
      expect(firstY(index)).toBe(height)
      await t.select('刻度策略', 'legacy')
      expect(ticks()[0]).toBe(1.3)
      expect(ticks()[ticks().length - 1]).toBe(8.7)
      await t.select('刻度策略', 'nice')
      for (const count of ['1', '1.5', '1000']) {
        await t.input('刻度数量', count)
        expect(t.field('刻度数量').find('[role=alert]').exists()).toBe(false)
        expect(ticks().length).toBeLessThanOrEqual(100)
        expect(ticks().every(Number.isFinite)).toBe(true)
      }
      for (const invalid of ['0', '-1', 'NaN', 'Infinity', '']) {
        const before = t.host.innerHTML
        await t.input('刻度数量', invalid)
        expect(t.field('刻度数量').find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input('刻度数量', '5')
      await t.input('最小值', '')
      await t.input('最大值', '')
      const before = t.node(selector).cloneNode(true)
      await t.toggle('显示坐标轴')
      expect(t.host.querySelector(selector)).toBeNull()
      expect(t.host.querySelectorAll('.waveform-axis-y')).toHaveLength(1)
      expect(t.lines()).toHaveLength(2)
      await t.toggle('显示坐标轴')
      expect(t.node(selector).isEqualNode(before)).toBe(true)
      await t.input('刻度数量', '6')
    },
  )

  it.each([0, 1])(
    'validates value axis %i tick geometry and colors without changing peer styles',
    async (index) => {
      const t = await setup()
      t.chart.updateOptions({ animationEnabled: false })
      await t.button('坐标轴')
      await t.button('值轴')
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择值轴')!
        .vm.$emit('update:value', index)
      await nextTick()
      const position = index === 0 ? 'left' : 'right'
      const axis = `.waveform-axis-y--${position}`
      const peer = `.waveform-axis-y--${index === 0 ? 'right' : 'left'}`
      const peerStyles = () =>
        [...t.host.querySelectorAll(`${peer} .tick`)].map((tick) => [
          ...['stroke', 'stroke-width', 'x2'].map((name) =>
            tick.querySelector('line')!.getAttribute(name),
          ),
          ...['fill', 'font-size', 'x'].map((name) =>
            tick.querySelector('text')!.getAttribute(name),
          ),
        ])
      const originalPeer = peerStyles()
      for (const [label, values, selector, attribute, sign, restore] of [
        [
          '刻度长度',
          ['9', '0', '0.25', '1000'],
          `${axis} .tick line`,
          'x2',
          index === 0 ? 1 : -1,
          '3',
        ],
        [
          '刻度间距',
          ['12', '0', '0.25', '1000'],
          `${axis} .tick text`,
          'x',
          index === 0 ? -1 : 1,
          '5',
        ],
        ['轴线宽度', ['2.5', '0', '0.25', '1000'], `${axis} .tick line`, 'stroke-width', 1, '1.3'],
        ['刻度字号', ['18', '1', '1.25', '1000'], `${axis} .tick text`, 'font-size', 1, '14'],
      ] as const) {
        for (const value of values) {
          await t.input(label, value)
          expect(Number(t.attr(selector, attribute))).toBe(Number(value) * sign || 0)
          if (label === '刻度字号')
            expect(Number(t.attr(`${axis} .waveform-axis-y-header`, 'font-size'))).toBe(
              Number(value),
            )
          expect(peerStyles()).toEqual(originalPeer)
        }
        for (const invalid of [
          '-1',
          'NaN',
          'Infinity',
          '',
          ...(label === '刻度字号' ? ['0', '0.5'] : []),
        ]) {
          const before = t.host.innerHTML
          await t.input(label, invalid)
          expect(t.field(label).find('[role=alert]').exists()).toBe(true)
          expect(t.host.innerHTML).toBe(before)
        }
        await t.input(label, restore)
      }
      for (const [label, selector, attribute, restore] of [
        ['轴线颜色', `${axis} .tick line`, 'stroke', index === 0 ? '#2563eb' : '#16a34a'],
        ['刻度文字颜色', `${axis} .tick text`, 'fill', index === 0 ? '#2563eb' : '#16a34a'],
      ] as const) {
        for (const color of ['#123456', 'rgba(37, 99, 235, 0.5)', 'transparent']) {
          await t.input(label, color)
          expect(t.attr(selector, attribute)).toBe(color)
          if (label === '刻度文字颜色')
            expect(t.attr(`${axis} .waveform-axis-y-header`, 'fill')).toBe(color)
          expect(peerStyles()).toEqual(originalPeer)
        }
        for (const invalid of ['not-a-color', '']) {
          const before = t.host.innerHTML
          await t.input(label, invalid)
          expect(t.field(label).find('[role=alert]').exists()).toBe(true)
          expect(t.host.innerHTML).toBe(before)
        }
        await t.input(label, restore)
      }
    },
  )

  it.each([0, 1])(
    'formats value axis %i with shared exponents, units and explicit format precedence',
    async (index) => {
      const t = await setup()
      t.chart.updateOptions({ animationEnabled: false })
      await t.button('坐标轴')
      await t.button('值轴')
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择值轴')!
        .vm.$emit('update:value', index)
      await nextTick()
      const axis = `.waveform-axis-y--${index === 0 ? 'left' : 'right'}`
      const texts = () =>
        [...t.host.querySelectorAll(`${axis} .tick text`)].map((node) => node.textContent)
      const header = () => t.host.querySelector(`${axis} .waveform-axis-y-header`)
      await t.input('最小值', '0')
      await t.input('最大值', '1000')
      await t.input('刻度数量', '3')
      await t.input('数字格式', '')
      expect(texts()).toEqual(['0', '0.5', '1'])
      for (const unit of ['V', ' 微伏 μV ', ' ', '长单位'.repeat(40), '']) {
        await t.input('刻度单位', unit)
        const parts = [unit.trim(), 'E+03'].filter(Boolean)
        expect(header()?.textContent).toBe(
          (index === 0 ? parts : parts.reverse()).join('\u00a0\u00a0'),
        )
        expect(texts()).toEqual(['0', '0.5', '1'])
        expect(t.field('刻度单位').find('[role=alert]').exists()).toBe(false)
      }
      await t.input('刻度单位', 'ms')
      for (const [format, expected] of [
        ['.2f', ['0.00', '500.00', '1000.00']],
        ['.1e', ['0.0e+0', '5.0e+2', '1.0e+3']],
      ] as const) {
        await t.input('数字格式', format)
        expect(texts()).toEqual(expected)
        expect(header()).toBeNull()
      }
      for (const invalid of ['not-a-format', '..2f']) {
        const before = t.host.innerHTML
        await t.input('数字格式', invalid)
        expect(t.field('数字格式').find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input('数字格式', '')
      expect(texts()).toEqual(['0', '0.5', '1'])
      expect(header()?.textContent).toBe(index === 0 ? 'ms\u00a0\u00a0E+03' : 'E+03\u00a0\u00a0ms')
      await t.input('最小值', '')
      await t.input('最大值', '')
      await t.input('刻度数量', '6')
    },
  )

  it.each([0, 1])(
    'validates value axis %i title content, appearance, automatic fitting and offset',
    async (index) => {
      const t = await setup()
      t.chart.updateOptions({ animationEnabled: false })
      await t.button('坐标轴')
      await t.button('值轴')
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择值轴')!
        .vm.$emit('update:value', index)
      await nextTick()
      const id = index === 0 ? 'left' : 'right'
      const selector = `.waveform-axis-y-title[data-axis-id="${id}"]`
      const title = () => t.host.querySelector(selector)!
      const originalText = t.chart.getOptions().yAxes![index].title!.text!
      const originalColor = index === 0 ? '#2563eb' : '#16a34a'
      const peer = `.waveform-axis-y-title[data-axis-id="${index === 0 ? 'right' : 'left'}"]`
      const peerContent = () => [
        t.node(peer).textContent,
        t.attr(peer, 'fill'),
        t.attr(peer, 'font-weight'),
      ]
      const originalPeer = peerContent()
      for (const text of ['Value', '值轴 Δ', ' ', '很长的值轴标题'.repeat(30), '']) {
        await t.input('轴标题', text)
        expect(title().textContent).toBe(`${text.trim() || originalText} (ms)`)
        expect(peerContent()).toEqual(originalPeer)
      }
      await t.input('轴标题', 'Value')
      for (const unit of ['V', '微伏 μV', ' ', '很长单位'.repeat(30), '']) {
        await t.input('标题单位', unit)
        expect(title().textContent).toBe(`Value${unit ? ` (${unit})` : ''}`)
        expect(Number(title().getAttribute('font-size'))).toBeLessThanOrEqual(14)
      }
      await t.input('标题单位', 'ms')
      for (const color of ['#123456', 'rgba(37, 99, 235, 0.5)', 'transparent']) {
        await t.input('标题颜色', color)
        expect(title().getAttribute('fill')).toBe(color)
      }
      for (const weight of ['700', 'bold', 'normal', '', '无效字重'.repeat(30)]) {
        await t.input('标题字重', weight)
        expect(title().getAttribute('font-weight')).toBe(weight)
      }
      await t.input('标题字重', '500')
      for (const size of ['18', '1', '1.25', '1000']) {
        await t.input('标题字号', size)
        const actual = Number(title().getAttribute('font-size'))
        expect(actual).toBeGreaterThan(0)
        expect(actual).toBeLessThanOrEqual(Number(size))
        if (Number(size) <= 18) expect(actual).toBe(Number(size))
        else expect(actual).toBeLessThan(Number(size))
      }
      await t.input('标题字号', '14')
      const gap = () => {
        const x = Number(
          title()
            .getAttribute('transform')!
            .match(/translate\(([^,]+),/)![1],
        )
        const border = t.node('.waveform-frame-border')
        const left = Number(
          border.parentElement!.getAttribute('transform')!.match(/translate\(([^,]+),/)![1],
        )
        return index === 0 ? left - x : x - left - Number(border.getAttribute('width'))
      }
      for (const offset of ['0', '25.25', '100']) {
        await t.input('标题偏移', offset)
        expect(gap()).toBeCloseTo(Number(offset), 8)
      }
      await t.input('标题偏移', '')
      expect(gap()).toBeGreaterThan(0)
      expect(t.chart.getOptions().yAxes![index].title?.offset).toBeUndefined()
      for (const [label, invalids, restore] of [
        ['标题颜色', ['not-a-color', ''], originalColor],
        ['标题字号', ['0', '0.5', '-1', 'NaN', 'Infinity', ''], '14'],
        ['标题偏移', ['-1', 'NaN', 'Infinity'], ''],
      ] as const) {
        for (const invalid of invalids) {
          const before = t.host.innerHTML
          await t.input(label, invalid)
          expect(t.field(label).find('[role=alert]').exists()).toBe(true)
          expect(t.host.innerHTML).toBe(before)
        }
        await t.input(label, restore)
      }
      const before = title().cloneNode(true)
      await t.toggle('显示轴标题')
      expect(t.host.querySelector(selector)).toBeNull()
      await t.toggle('显示轴标题')
      expect(title().isEqualNode(before)).toBe(true)
      expect(peerContent()).toEqual(originalPeer)
      await t.input('轴标题', originalText)
    },
  )

  it('maps optional X bounds exactly, handles reversed and equal domains, and restores automatic bounds', async () => {
    const t = await setup()
    t.chart.update({
      data: [
        { x: 1, y: -1 },
        { x: 4, y: 1 },
      ],
      options: { animationEnabled: false },
    })
    await t.button('坐标轴')
    await t.select('范围策略', 'data')
    const endpoints = () =>
      [...t.host.querySelectorAll('.waveform-axis-x-endpoint')].map((node) => node.textContent)
    expect(endpoints()).toEqual(['1', '4'])
    await t.input('最小值', '-5')
    expect(endpoints()).toEqual(['−5', '4'])
    await t.input('最大值', '20')
    expect(endpoints()).toEqual(['−5', '20'])
    const width = Number(t.attr('.waveform-frame-border', 'width'))
    const firstX = () =>
      Number(
        t
          .lines()[0]
          .getAttribute('d')!
          .match(/^M([^,]+),/)![1],
      )
    expect(firstX()).toBeCloseTo((width * 6) / 25, 3)
    await t.input('最小值', '30')
    expect(endpoints()).toEqual(['30', '20'])
    await t.input('最小值', '2')
    await t.input('最大值', '2')
    expect(endpoints()).toEqual(['1', '3'])
    for (const label of ['最小值', '最大值']) {
      for (const invalid of ['NaN', 'Infinity', 'not-a-number']) {
        const before = t.host.innerHTML
        await t.input(label, invalid)
        expect(t.field(label).find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input(label, '')
      expect(t.field(label).find('[role=alert]').exists()).toBe(false)
    }
    expect(endpoints()).toEqual(['1', '4'])
    expect(t.chart.getOptions().xAxis?.min).toBeUndefined()
    expect(t.chart.getOptions().xAxis?.max).toBeUndefined()
  })

  it('keeps X tick density, minimum interval and explicit step priorities observable in the grid', async () => {
    const t = await setup()
    t.chart.updateOptions({ animationEnabled: false })
    await t.button('坐标轴')
    await t.select('范围策略', 'data')
    await t.input('最小值', '0')
    await t.input('最大值', '14')
    await t.input('刻度数量', '5')
    await t.select('刻度策略', 'nice')
    const values = () =>
      [...t.host.querySelectorAll('.waveform-grid-x .tick')].map(
        (node) => (node as Element & { __data__: number }).__data__,
      )
    expect(values()).toEqual([0, 3, 6, 9, 12])
    await t.select('刻度策略', 'legacy')
    expect(values()).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
    await t.select('刻度策略', 'nice')
    await t.input('最小刻度间隔', '4')
    expect(values()).toEqual([0, 4, 8, 12])
    await t.input('刻度步长', '2')
    expect(values()).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
    await t.input('最大值', '0.5')
    await t.input('刻度步长', '0.1')
    expect(values()).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5])
    await t.input('刻度步长', '10')
    expect(values()).toEqual([])
    await t.input('刻度步长', '')
    await t.input('最小刻度间隔', '0')
    await t.input('最大值', '14')
    for (const count of ['1', '1.5', '1000']) {
      await t.input('刻度数量', count)
      expect(t.field('刻度数量').find('[role=alert]').exists()).toBe(false)
      expect(values().length).toBeLessThanOrEqual(100)
      expect(values().every(Number.isFinite)).toBe(true)
    }
    for (const [label, invalids, restore] of [
      ['刻度数量', ['0', '-1', 'NaN', 'Infinity', ''], '5'],
      ['最小刻度间隔', ['-1', 'NaN', 'Infinity', ''], '0'],
      ['刻度步长', ['0', '-1', 'NaN', 'Infinity'], ''],
    ] as const) {
      for (const invalid of invalids) {
        const before = t.host.innerHTML
        await t.input(label, invalid)
        expect(t.field(label).find('[role=alert]').exists(), `${label}: ${invalid}`).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input(label, restore)
      expect(t.field(label).find('[role=alert]').exists()).toBe(false)
    }
    expect(values()).toEqual([0, 3, 6, 9, 12])
  })

  it('applies shared and per-direction grid width, axis binding and visibility', async () => {
    const t = await setup()
    await t.button('网格')
    await t.input('辅助线颜色', '#123456')
    await t.input('辅助线宽度', '2.5')
    for (const axis of ['x', 'y']) {
      expect(t.attr(`.waveform-grid-${axis} line`, 'stroke')).toBe('#123456')
      expect(t.attr(`.waveform-grid-${axis} line`, 'stroke-width')).toBe('2.5')
    }
    await t.input('X 网格宽度', '4')
    await t.input('Y 网格宽度', '5')
    await t.input('辅助线宽度', '1')
    expect(t.attr('.waveform-grid-x line', 'stroke-width')).toBe('4')
    expect(t.attr('.waveform-grid-y line', 'stroke-width')).toBe('5')
    await t.select('辅助线样式', 'solid')
    expect(t.attr('.waveform-grid-x line', 'stroke-dasharray')).toBeNull()
    await t.select('Y 网格参考轴', 'right')
    expect(t.attr('.waveform-grid-y', 'data-axis-id')).toBe('right')
    await t.toggle('显示 X 网格')
    expect(t.host.querySelector('.waveform-grid-x')).toBeNull()
    await t.toggle('显示网格')
    expect(t.host.querySelectorAll('.waveform-grid')).toHaveLength(0)
    await t.toggle('显示网格')
    expect(t.host.querySelector('.waveform-grid-y')).not.toBeNull()
  })

  it('shows a zero line only for a domain spanning zero and applies its exact style', async () => {
    const t = await setup()
    await t.button('网格')
    await t.button('零线')
    expect(t.host.querySelector('.waveform-zero-line')).toBeNull()
    await t.button('坐标轴')
    await t.button('值轴')
    await t.input('最小值', '-10')
    await t.input('最大值', '10')
    await t.button('网格')
    for (const [label, value, attribute] of [
      ['零线颜色', '#123456', 'stroke'],
      ['零线透明度', '0.25', 'stroke-opacity'],
      ['零线宽度', '2.5', 'stroke-width'],
      ['零线虚线', '8 2', 'stroke-dasharray'],
    ]) {
      await t.input(label, value)
      expect(t.attr('.waveform-zero-line', attribute)).toBe(value)
    }
    const beforeInvalid = t.host.innerHTML
    for (const [label, value] of [
      ['零线颜色', 'not-a-color'],
      ['零线颜色', ''],
      ['零线透明度', '-0.1'],
      ['零线透明度', '1.1'],
      ['零线宽度', '-1'],
      ['零线宽度', ''],
    ]) {
      await t.input(label, value)
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(beforeInvalid)
    }
    await t.toggle('显示零线')
    expect(t.host.querySelector('.waveform-zero-line')).toBeNull()
    await t.toggle('显示零线')
    expect(t.attr('.waveform-zero-line', 'stroke-opacity')).toBe('0.25')
  })

  it('preserves free SVG dash text for the zero line, including empty and CSS fallback values', async () => {
    const t = await setup()
    t.chart.updateOptions({
      animationEnabled: false,
      yAxes: [{ id: 'left', min: -10, max: 10 }, { id: 'right' }],
    })
    await t.button('网格')
    await t.button('零线')
    const geometry = () => t.lines().map((line) => line.getAttribute('d'))
    const before = geometry()
    for (const dash of [
      '8 2',
      '0',
      '0.5, 2.25',
      '3 2 1',
      '10%',
      'none',
      '',
      ' ',
      '-1 2',
      'not-a-dash',
      '4 4',
    ]) {
      await t.input('零线虚线', dash)
      expect(t.field('零线虚线').find('[role=alert]').exists()).toBe(false)
      expect(t.chart.getOptions().zeroLine?.dash).toBe(dash)
      expect(t.attr('.waveform-zero-line', 'stroke-dasharray')).toBe(dash)
      expect(geometry()).toEqual(before)
    }
    await t.toggle('显示零线')
    await t.toggle('显示零线')
    expect(t.attr('.waveform-zero-line', 'stroke-dasharray')).toBe('4 4')
  })

  it('validates grid color and shared or directional width boundaries without altering the curves', async () => {
    const t = await setup()
    await t.button('网格')
    const geometry = () => t.lines().map((line) => line.getAttribute('d'))
    const initialGeometry = geometry()
    for (const value of ['#123456', 'rgba(37, 99, 235, 0.5)', 'transparent']) {
      await t.input('辅助线颜色', value)
      for (const axis of ['x', 'y'])
        expect(t.attr(`.waveform-grid-${axis} line`, 'stroke')).toBe(value)
    }
    for (const value of ['not-a-color', '']) {
      const before = t.host.innerHTML
      await t.input('辅助线颜色', value)
      expect(t.field('辅助线颜色').find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(before)
    }
    await t.input('辅助线颜色', '#475569')
    for (const [label, axes] of [
      ['辅助线宽度', ['x', 'y']],
      ['X 网格宽度', ['x']],
      ['Y 网格宽度', ['y']],
    ] as const) {
      const peer = label === 'X 网格宽度' ? t.attr('.waveform-grid-y line', 'stroke-width') : null
      for (const value of ['2.5', '0', '0.25', '1000']) {
        await t.input(label, value)
        for (const axis of axes)
          expect(t.attr(`.waveform-grid-${axis} line`, 'stroke-width')).toBe(value)
        if (label === 'X 网格宽度')
          expect(t.attr('.waveform-grid-y line', 'stroke-width')).toBe(peer)
      }
      for (const value of ['-1', 'NaN', 'Infinity', '']) {
        const before = t.host.innerHTML
        await t.input(label, value)
        expect(t.field(label).find('[role=alert]').exists(), `${label}: ${value}`).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
      await t.input(label, '1')
      expect(t.field(label).find('[role=alert]').exists()).toBe(false)
    }
    await t.input('X 网格宽度', '4')
    await t.input('Y 网格宽度', '5')
    await t.input('辅助线宽度', '3')
    expect(t.attr('.waveform-grid-x line', 'stroke-width')).toBe('4')
    expect(t.attr('.waveform-grid-y line', 'stroke-width')).toBe('5')
    expect(geometry()).toEqual(initialGeometry)
  })

  it('validates chart-title content and typography boundaries, CSS fallback and restoration', async () => {
    const t = await setup()
    await t.button('文字')
    await t.toggle('显示图表标题')
    const title = () =>
      [...t.host.querySelectorAll('svg > text')].find((node) => node.getAttribute('y') === '24')!
    for (const text of ['Audit', '  标题 Ω 中文  ', ' ', '长标题'.repeat(60), '']) {
      await t.input('图表标题', text)
      expect(t.field('图表标题').find('[role=alert]').exists()).toBe(false)
      if (text) expect(title().textContent).toBe(text)
      else expect(title()).toBeUndefined()
    }
    await t.input('图表标题', 'Audit')
    for (const [label, attribute, values] of [
      ['标题颜色', 'fill', ['#123456', 'rgba(20, 40, 60, 0.5)', 'transparent']],
      ['标题字号', 'font-size', ['1', '1.25', '22', '1000']],
      ['标题字重', 'font-weight', ['700', 'bold', 'normal', '', 'invalid-weight']],
    ] as const)
      for (const value of values) {
        await t.input(label, value)
        expect(title().getAttribute(attribute)).toBe(value)
        expect(t.field(label).find('[role=alert]').exists()).toBe(false)
      }
    for (const [label, values] of [
      ['标题颜色', ['', 'not-a-color']],
      ['标题字号', ['0', '0.5', '-1', 'NaN', 'Infinity', '']],
    ] as const)
      for (const value of values) {
        const before = t.host.innerHTML
        await t.input(label, value)
        expect(t.field(label).find('[role=alert]').exists()).toBe(true)
        expect(t.host.innerHTML).toBe(before)
      }
    await t.input('标题颜色', '#0f172a')
    await t.input('标题字号', '16')
    await t.input('标题字重', '600')
    const beforeHidden = title().cloneNode(true)
    await t.toggle('显示图表标题')
    expect(title()).toBeUndefined()
    await t.toggle('显示图表标题')
    expect(title().isEqualNode(beforeHidden)).toBe(true)
  })

  it.each(['shot', 'number'] as const)(
    'validates %s text-style boundaries and automatic sizing without losing hidden settings',
    async (kind) => {
      const t = await setup()
      await t.button('文字')
      await t.button(kind === 'shot' ? '炮号' : '图框编号')
      const selector = kind === 'shot' ? '.waveform-shot' : '.waveform-frame-number'
      const color = kind === 'shot' ? '炮号颜色' : '编号颜色'
      const font = kind === 'shot' ? '炮号字号' : '编号字号'
      const weight = kind === 'shot' ? '炮号字重' : '编号字重'
      if (kind === 'shot') {
        for (const text of ['Shot', '  炮号 Ω 中文  ', ' ', '长炮号'.repeat(60), '']) {
          await t.input('炮号文字', text)
          if (text) expect(t.node(selector).textContent).toBe(text)
          else expect(t.host.querySelector(selector)).toBeNull()
        }
        await t.input('炮号文字', 'S1')
      } else await t.input('图框编号', '42')
      for (const value of ['#123456', 'rgba(20, 40, 60, 0.5)', 'transparent']) {
        await t.input(color, value)
        expect(t.attr(selector, 'fill')).toBe(value)
      }
      for (const value of ['1', '1.25', '18', '1000']) {
        await t.input(font, value)
        const size = Number(t.attr(selector, 'font-size'))
        expect(size).toBeGreaterThanOrEqual(0)
        expect(size).toBeLessThanOrEqual(Number(value))
        if (Number(value) <= 18) expect(size).toBe(Number(value))
      }
      for (const value of ['700', 'bold', 'normal', '', 'invalid-weight']) {
        await t.input(weight, value)
        expect(t.attr(selector, 'font-weight')).toBe(value)
      }
      for (const [label, values] of [
        [color, ['', 'not-a-color']],
        [font, ['0', '0.5', '-1', 'NaN', 'Infinity', ...(kind === 'shot' ? [''] : [])]],
      ] as const) {
        for (const value of values) {
          const before = t.host.innerHTML
          await t.input(label, value)
          expect(t.field(label).find('[role=alert]').exists()).toBe(true)
          expect(t.host.innerHTML).toBe(before)
        }
      }
      await t.input(color, '#123456')
      await t.input(font, '18')
      await t.input(weight, '700')
      if (kind === 'number') {
        for (const value of ['0', '0.25', '1']) {
          await t.input('编号透明度', value)
          expect(t.attr(selector, 'opacity')).toBe(value)
        }
        for (const value of ['-0.1', '1.1', 'NaN', 'Infinity', '']) {
          const before = t.host.innerHTML
          await t.input('编号透明度', value)
          expect(t.field('编号透明度').find('[role=alert]').exists()).toBe(true)
          expect(t.host.innerHTML).toBe(before)
        }
        await t.input('编号透明度', '0.1')
        for (const value of ['serif', '"Courier New", monospace', '', '   ']) {
          await t.input('编号字体', value)
          expect(t.attr(selector, 'font-family')).toBe(
            value.trim() || "Consolas, Monaco, 'Courier New', monospace",
          )
        }
        await t.input('编号字号', '')
        const width = Number(t.attr('.waveform-frame-border', 'width'))
        const height = Number(t.attr('.waveform-frame-border', 'height'))
        expect(Number(t.attr(selector, 'font-size'))).toBeCloseTo(
          Math.min(120, height * 0.65, (width * 0.9) / (2 * 0.6)),
        )
      } else {
        const before = t.node(selector).cloneNode(true)
        await t.toggle('显示炮号')
        expect(t.host.querySelector(selector)).toBeNull()
        await t.toggle('显示炮号')
        expect(t.node(selector).isEqualNode(before)).toBe(true)
      }
    },
  )

  it('applies title, shot and frame-number text and typography', async () => {
    const t = await setup()
    await t.button('文字')
    await t.input('图表标题', 'Control audit')
    await t.toggle('显示图表标题')
    const title = () =>
      Array.from(t.host.querySelectorAll('svg text')).find(
        (node) => node.textContent === 'Control audit',
      )!
    await t.input('标题颜色', '#123456')
    await t.input('标题字号', '22')
    await t.input('标题字重', '700')
    expect(title().getAttribute('fill')).toBe('#123456')
    expect(title().getAttribute('font-size')).toBe('22')
    expect(title().getAttribute('font-weight')).toBe('700')
    for (const [align, anchor] of [
      ['left', 'start'],
      ['center', 'middle'],
      ['right', 'end'],
    ] as const) {
      await t.select('标题对齐', align)
      expect(title().getAttribute('text-anchor')).toBe(anchor)
    }
    await t.input('图表标题', '  标题 Ω 中文  ')
    expect(t.host.textContent).toContain('标题 Ω 中文')
    await t.input('图表标题', 'x'.repeat(160))
    expect(t.host.querySelectorAll('svg text').length).toBeGreaterThan(0)
    await t.button('炮号')
    await t.input('炮号文字', '  炮号 Ω 中文  ')
    await t.input('炮号颜色', '#654321')
    await t.input('炮号字号', '18')
    expect(t.node('.waveform-shot').textContent).toBe('  炮号 Ω 中文  ')
    expect(t.attr('.waveform-shot', 'fill')).toBe('#654321')
    expect(Number(t.attr('.waveform-shot', 'font-size'))).toBeGreaterThan(0)
    expect(Number(t.attr('.waveform-shot', 'font-size'))).toBeLessThanOrEqual(18)
    await t.input('炮号文字', 'x'.repeat(120))
    expect(t.node('.waveform-shot').textContent).toBe('x'.repeat(120))
    expect(Number(t.attr('.waveform-shot', 'font-size'))).toBeGreaterThan(0)
    expect(Number(t.attr('.waveform-shot', 'font-size'))).toBeLessThanOrEqual(18)
    await t.toggle('显示炮号')
    expect(t.host.querySelector('.waveform-shot')).toBeNull()
    await t.button('图框编号')
    await t.input('图框编号', '42')
    expect(t.node('.waveform-frame-number').textContent).toBe('42')
    for (const [label, value, attribute] of [
      ['编号颜色', '#123456', 'fill'],
      ['编号透明度', '0.3', 'opacity'],
      ['编号字号', '40', 'font-size'],
      ['编号字体', 'serif', 'font-family'],
      ['编号字重', '700', 'font-weight'],
    ]) {
      await t.input(label, value)
      expect(t.attr('.waveform-frame-number', attribute)).toBe(value)
    }
    await t.input('图框编号', '')
    expect(t.host.querySelector('.waveform-frame-number')).toBeNull()
  })

  it('updates legend layout and empty-state content, and restores the original curves', async () => {
    const t = await setup()
    await t.button('文字')
    await t.button('图例')
    await t.input('图例文字颜色', '#123456')
    await t.input('图例字号', '18')
    await t.input('图例线长', '36')
    expect(t.attr('.waveform-legend text', 'fill')).toBe('#123456')
    expect(t.attr('.waveform-legend text', 'font-size')).toBe('18')
    expect(t.attr('.waveform-legend line', 'x2')).toBe('36')
    await t.select('图例方向', 'vertical')
    await t.select('图例位置', 'bottom-left')
    expect(t.host.querySelectorAll('.waveform-legend-item')).toHaveLength(4)
    await t.input('单项最大宽度', '70')
    expect(t.node('.waveform-legend text').textContent).toContain('…')
    const beforeLegendInvalid = t.host.innerHTML
    for (const [label, value] of [
      ['图例文字颜色', 'not-a-color'],
      ['图例文字颜色', ''],
      ['图例字号', '0'],
      ['图例字号', ''],
      ['图例间距', '-1'],
      ['图例间距', ''],
      ['图例线长', '0'],
      ['图例线长', ''],
      ['单项最大宽度', '0'],
      ['单项最大宽度', ''],
    ]) {
      await t.input(label, value)
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(beforeLegendInvalid)
    }
    await t.toggle('显示图例')
    expect(t.host.querySelector('.waveform-legend')).toBeNull()
    await t.button('空状态')
    await t.toggle('预览空数据状态')
    t.chart.animation.finish()
    await t.input('提示文字', 'Nothing here')
    await t.input('提示颜色', '#123456')
    await t.input('提示字号', '20')
    const empty = Array.from(t.host.querySelectorAll('text')).find(
      (node) => node.textContent === 'Nothing here',
    )!
    expect(empty.getAttribute('fill')).toBe('#123456')
    expect(empty.getAttribute('font-size')).toBe('20')
    expect(t.lines()).toHaveLength(0)
    const beforeEmptyInvalid = t.host.innerHTML
    for (const [label, value] of [
      ['提示颜色', 'not-a-color'],
      ['提示颜色', ''],
      ['提示字号', '0'],
      ['提示字号', ''],
    ]) {
      await t.input(label, value)
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(beforeEmptyInvalid)
    }
    await t.toggle('显示空数据文字')
    expect(t.host.textContent).not.toContain('Nothing here')
    await t.toggle('预览空数据状态')
    t.chart.animation.finish()
    expect(t.lines()).toHaveLength(4)
  })

  it('distinguishes all legend series hidden from empty preview and restores both states', async () => {
    const t = await setup()
    const seriesIds = ['1157', '1156', '1159', '1155']
    for (const seriesId of seriesIds) t.chart.dispatchAction({ type: 'toggleSeries', seriesId })
    expect(t.lines()).toHaveLength(0)
    const hasEmptyText = () =>
      Array.from(t.host.querySelectorAll('svg text')).some(
        (text) => text.textContent === 'No waveform data',
      )
    expect(hasEmptyText()).toBe(false)
    for (const seriesId of seriesIds) t.chart.dispatchAction({ type: 'toggleSeries', seriesId })
    expect(t.lines()).toHaveLength(4)
    await t.button('文字')
    await t.button('空状态')
    await t.toggle('预览空数据状态')
    t.chart.animation.finish()
    expect(t.lines()).toHaveLength(0)
    expect(hasEmptyText()).toBe(true)
    await t.toggle('预览空数据状态')
    t.chart.animation.finish()
    expect(t.lines()).toHaveLength(4)
  })

  it('applies the global animation switch to subsequent data scenarios', async () => {
    const t = await setup()
    await t.button('数据场景')
    const animationSwitch = t.wrapper.find('[aria-label="启用动画（影响后续数据更新）"]')
    expect(animationSwitch.attributes('aria-checked')).toBe('true')
    t.chart.updateOptions({ animationThreshold: 100000 })
    t.chart.animation.finish()
    const beforeEnabled = t.lines().map((line) => line.getAttribute('d'))
    await t.button('追加点')
    expect(t.lines()).toHaveLength(4)
    expect(t.lines().map((line) => line.getAttribute('d'))).not.toEqual(beforeEnabled)
    t.chart.animation.finish()
    await animationSwitch.trigger('click')
    await nextTick()
    expect(animationSwitch.attributes('aria-checked')).toBe('false')
    await t.button('追加点')
    expect(t.chart.animation.isRunning()).toBe(false)
  })

  it('validates entrance timing fields without changing the last valid animation options', async () => {
    const t = await setup()
    const before = t.chart.getOptions().animation
    for (const label of ['入场时长（ms）', '入场延迟（ms）', '错峰间隔（ms）']) {
      const beforeSvg = t.host.innerHTML
      await t.input(label, '-1')
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(beforeSvg)
      await t.input(label, '')
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(beforeSvg)
    }
    await t.input('入场时长（ms）', '0')
    await t.input('入场延迟（ms）', '100')
    await t.input('错峰间隔（ms）', '50')
    expect(t.chart.getOptions().animation).toMatchObject({
      duration: 0,
      delay: 100,
      staggerDelay: 50,
    })
    expect(before?.duration).toBe(1000)
  })

  it('enables replay only when animation and preview data are available', async () => {
    const t = await setup()
    const replay = () =>
      t.wrapper.findAll('button').find((item) => item.text().replace(/\s/g, '') === '重播入场')!
    expect(replay().attributes('disabled')).toBeUndefined()
    await t.wrapper.find('[aria-label="启用动画（影响后续数据更新）"]').trigger('click')
    await nextTick()
    expect(replay().attributes('disabled')).toBeDefined()
    await t.wrapper.find('[aria-label="启用动画（影响后续数据更新）"]').trigger('click')
    await nextTick()
    await t.button('文字')
    await t.button('空状态')
    await t.toggle('预览空数据状态')
    t.chart.animation.finish()
    expect(replay().attributes('disabled')).toBeDefined()
    await t.toggle('预览空数据状态')
    t.chart.animation.finish()
    expect(replay().attributes('disabled')).toBeUndefined()
  })

  it.each([0, 1, 2, 3])(
    'edits all eleven overrides on curve %s and restores inheritance without affecting explicit peers',
    async (index) => {
      const t = await setup()
      const panel = t.wrapper.findComponent(ConfigPanel)
      const originals = (panel.props() as unknown as { series: WaveformSeries[] }).series
      const custom = {
        color: '#123456',
        lineWidth: 3,
        lineType: 'linear' as const,
        lineStyle: 'solid' as const,
        opacity: 0.8,
        point: {
          visible: true,
          type: 'square' as const,
          size: 3,
          color: '#234567',
          borderColor: '#345678',
          borderWidth: 2,
        },
      }
      panel.vm.$emit(
        'series',
        originals.map((series) => ({
          ...series,
          style: structuredClone(custom),
          data: [
            { id: 'a', x: 0, y: -1 },
            { id: 'b', x: 1, y: 1 },
            { id: 'c', x: 2, y: 0 },
          ],
        })),
      )
      await nextTick()
      t.chart.animation.finish()
      await t.button('曲线')
      const beforeSelect = t.host.innerHTML
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择曲线')!
        .vm.$emit('update:value', index)
      await nextTick()
      expect(t.host.innerHTML).toBe(beforeSelect)
      const pointsFor = (i: number) => {
        const sibling = t.lines()[i].nextElementSibling
        return sibling?.tagName.toLowerCase() === 'g' ? sibling : undefined
      }
      const peerState = () =>
        t.lines().map((line, i) => (i === index ? null : [line.outerHTML, pointsFor(i)?.outerHTML]))
      const peers = peerState()
      const values = [
        '#abcdef',
        7,
        'step-end',
        'dashed',
        0.4,
        false,
        'triangle',
        6,
        '#fedcba',
        '#654321',
        4,
      ]
      const later = [
        '#aabbcc',
        5,
        'step-start',
        'dash-dot',
        0.6,
        true,
        'diamond',
        4,
        '#112233',
        '#445566',
        1,
      ]
      for (const [fieldIndex, field] of seriesFields.entries()) {
        await t.button(field.category === 'line' ? '线条' : '数据点')
        expect(t.wrapper.find(`input[aria-label="${field.label}跟随全局"]`).element).toHaveProperty(
          'checked',
          false,
        )
        if (field.kind === 'select') await t.select(field.label, String(values[fieldIndex]))
        else if (field.kind === 'boolean') await t.toggle(field.label)
        else await t.input(field.label, String(values[fieldIndex]))
        const committed = () =>
          (panel.props() as unknown as { series: WaveformSeries[] }).series[index]
        const at = (value: unknown, path: string) =>
          path.split('.').reduce((item, key) => (item as Record<string, unknown>)[key], value)
        expect(at(committed(), field.path)).toBe(values[fieldIndex])
        expect(peerState()).toEqual(peers)
        await t.wrapper.find(`input[aria-label="${field.label}跟随全局"]`).setValue(true)
        await nextTick()
        expect(at(committed(), field.path)).toBeUndefined()
        expect(
          t.field(field.label).find('input, [role=switch], .ant-select').attributes('disabled') !==
            undefined || t.field(field.label).find('.ant-select-disabled').exists(),
        ).toBe(true)
        panel.vm.$emit('field', field.inherited, later[fieldIndex])
        await nextTick()
        expect(peerState()).toEqual(peers)
        const line = t.lines()[index]
        const point = pointsFor(index)?.querySelector('path')
        if (field.path === 'style.color')
          expect(line.getAttribute('stroke')).toBe(later[fieldIndex])
        if (field.path === 'style.lineWidth')
          expect(line.getAttribute('stroke-width')).toBe(String(later[fieldIndex]))
        if (field.path === 'style.lineStyle')
          expect(line.getAttribute('stroke-dasharray')).toBe('8 4 2 4')
        if (field.path === 'style.lineType') {
          const w = Number(t.attr('.waveform-frame-border', 'width')),
            h = Number(t.attr('.waveform-frame-border', 'height'))
          const expected = [0, h, 0, 0, w / 2, 0, w / 2, h / 2, w, h / 2]
          const actual = line
            .getAttribute('d')!
            .match(/-?[\d.]+/g)!
            .map(Number)
          expect(actual).toHaveLength(expected.length)
          actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 3))
        }
        if (field.path === 'style.opacity')
          expect(line.getAttribute('stroke-opacity')).toBe(String(later[fieldIndex]))
        if (field.path === 'style.point.visible') expect(point).toBeTruthy()
        if (field.path === 'style.point.color')
          expect(point?.getAttribute('fill')).toBe(later[fieldIndex])
        if (field.path === 'style.point.borderColor')
          expect(point?.getAttribute('stroke')).toBe(later[fieldIndex])
        if (field.path === 'style.point.borderWidth')
          expect(point?.getAttribute('stroke-width')).toBe(String(later[fieldIndex]))
        if (field.path === 'style.point.type' || field.path === 'style.point.size') {
          const numbers = point!
            .getAttribute('d')!
            .match(/-?[\d.]+/g)!
            .map(Number)
          const vertices = Array.from({ length: numbers.length / 2 }, (_, i) => [
            numbers[i * 2],
            numbers[i * 2 + 1],
          ])
          const area =
            Math.abs(
              vertices.reduce((sum, vertex, i) => {
                const next = vertices[(i + 1) % vertices.length]
                return sum + vertex[0] * next[1] - vertex[1] * next[0]
              }, 0),
            ) / 2
          expect(vertices).toHaveLength(4)
          expect(area).toBeCloseTo(4 * (field.path === 'style.point.size' ? 4 : 3) ** 2, 1)
        }
      }
    },
  )

  it('returns a curve to global inheritance without changing its peers', async () => {
    const t = await setup()
    await t.button('线点')
    await t.input('线条颜色', '#123456')
    await t.input('线条宽度', '4.5')
    await t.button('曲线')
    await t.wrapper.find('input[aria-label="颜色跟随全局"]').setValue(true)
    await t.wrapper.find('input[aria-label="线宽跟随全局"]').setValue(true)
    await nextTick()
    expect(t.lines()[0].getAttribute('stroke')).toBe('#123456')
    expect(t.lines()[0].getAttribute('stroke-width')).toBe('4.5')
    expect(t.lines()[1].getAttribute('stroke-width')).toBe('1.5')
    await t.button('线点')
    await t.input('线条颜色', '#654321')
    await t.input('线条宽度', '6')
    expect(t.lines()[0].getAttribute('stroke')).toBe('#654321')
    expect(t.lines()[0].getAttribute('stroke-width')).toBe('6')
    expect(t.lines()[1].getAttribute('stroke')).toBe('#dc2626')
    expect(t.lines()[1].getAttribute('stroke-width')).toBe('1.5')
  })

  it('loads the selected curve form and edits only that curve', async () => {
    const t = await setup()
    await t.button('曲线')
    const selectSeries = (index: number) => {
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择曲线')!
        .vm.$emit('update:value', index)
    }
    selectSeries(1)
    await nextTick()
    expect(t.wrapper.find('input[aria-label="颜色跟随全局"]').element).toHaveProperty(
      'checked',
      false,
    )
    expect(t.field('颜色').find('input').element).toHaveProperty('value', '#dc2626')
    const peerColor = t.lines()[0].getAttribute('stroke')
    await t.input('颜色', '#123abc')
    await t.input('线宽', '4.5')
    expect(t.lines()[1].getAttribute('stroke')).toBe('#123abc')
    expect(t.lines()[1].getAttribute('stroke-width')).toBe('4.5')
    expect(t.lines()[0].getAttribute('stroke')).toBe(peerColor)
    expect(t.lines()[0].getAttribute('stroke-width')).toBe('1.5')
  })

  it('maps a curve to the selected axis and back using each axis scale', async () => {
    const t = await setup()
    await t.button('坐标轴')
    await t.button('值轴')
    const selectAxis = async (index: number) => {
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择值轴')!
        .vm.$emit('update:value', index)
      await nextTick()
    }
    await selectAxis(0)
    await t.input('最小值', '-1')
    await t.input('最大值', '1')
    await selectAxis(1)
    await t.input('最小值', '-100')
    await t.input('最大值', '100')
    await t.button('曲线')
    const selectSeries = (index: number) =>
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '选择曲线')!
        .vm.$emit('update:value', index)
    const selectSeriesAxis = async (value: string) => {
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '坐标轴')!
        .vm.$emit('update:value', value)
      await nextTick()
    }
    selectSeries(0)
    await nextTick()
    const firstPointY = () =>
      Number(
        t
          .lines()[0]
          .getAttribute('d')
          ?.match(/^M[^,]+,([^L]+)/)?.[1],
      )
    const leftY = firstPointY()
    await selectSeriesAxis('right')
    const rightY = firstPointY()
    expect(rightY).not.toBe(leftY)
    expect(
      t.wrapper
        .findAllComponents(Select)
        .find((item) => item.attributes('aria-label') === '坐标轴')!
        .props('value'),
    ).toBe('right')
    await selectSeriesAxis('left')
    expect(firstPointY()).toBe(leftY)
  })

  it('represents an intentional zero series width accurately in the legend and export', async () => {
    const t = await setup()
    await t.button('曲线')
    await t.input('线宽', '0')
    expect(t.lines()[0].getAttribute('stroke-width')).toBe('0')
    // The legend must represent the actual curve, including an intentional zero width.
    expect(t.attr('.waveform-legend-item line', 'stroke-width')).toBe('0')
    const exported = new DOMParser().parseFromString(t.chart.toSVGString(), 'image/svg+xml')
    expect(exported.querySelector('.waveform-legend-item line')?.getAttribute('stroke-width')).toBe(
      '0',
    )
  })

  it('rejects invalid color, format and tick step without altering existing SVG', async () => {
    const t = await setup()
    await t.button('线点')
    const before = t.host.innerHTML
    await t.input('线条颜色', 'invalid-color')
    expect(t.field('线条颜色').find('[role=alert]').exists()).toBe(true)
    expect(t.host.innerHTML).toBe(before)
    await t.button('坐标轴')
    for (const [label, value] of [
      ['数字格式', 'invalid format'],
      ['刻度步长', '0'],
      ['刻度步长', '-1'],
    ]) {
      const previous = t.host.innerHTML
      await t.input(label, value)
      expect(t.field(label).find('[role=alert]').exists()).toBe(true)
      expect(t.host.innerHTML).toBe(previous)
    }
  })
})
