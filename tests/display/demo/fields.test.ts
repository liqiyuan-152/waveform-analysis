// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Select, Slider } from 'ant-design-vue'
import { tabs as legacyTabs, parseNumberInput as oldNumber } from '../fixtures/legacyConfigPanel'
import {
  tabs,
  axisFields,
  parseNumberInput,
  parseDimension,
  type FieldDefinition,
} from '../../../demo-app/src/display/config/fields'
import ConfigField from '../../../demo-app/src/display/components/config-panel/ConfigField.vue'
import { seriesFields } from '../../../demo-app/src/display/config/seriesFields'

const fields = tabs.flatMap((tab) => tab.subsections?.flatMap((section) => section.fields) ?? [])
describe('configuration field migration', () => {
  it('retains every legacy field and validation boundary', () => {
    const previous = legacyTabs.flatMap(
      (tab) => tab.subsections?.flatMap((section) => section.fields) ?? [],
    )
    const current = [
      ...fields,
      ...axisFields('yAxis', false),
      ...axisFields('secondaryYAxis', false),
    ]
    for (const field of previous) {
      const migrated = current.find((candidate) => candidate.path === field.path)
      expect(migrated, field.path).toBeDefined()
      expect(migrated?.kind, field.path).toBe(field.kind)
      expect(migrated?.min, field.path).toBe(field.min)
      expect(migrated?.max, field.path).toBe(field.max)
    }
    for (const raw of ['', '0', '-1', '1.23456789', '1e-8', '1e', '12px', '100%']) {
      expect(parseNumberInput(raw, true)).toEqual(oldNumber(raw, true))
    }
  })

  it('accepts positive dimensions and rejects unsupported or invalid lengths', () => {
    for (const raw of ['640', '1.23456789', '1e-8', '12px', '100%', '50%', '.5px']) {
      expect(parseDimension(raw).valid, raw).toBe(true)
    }
    for (const raw of ['', '0', '-1', '1e', '0%', '101%', 'Infinity', 'NaN', '2em', 'abc']) {
      expect(parseDimension(raw).valid, raw).toBe(false)
    }
  })

  it.each([...fields, ...seriesFields].filter((field) => field.kind === 'range'))(
    'keeps invalid $path text separate from the committed slider value',
    async (field) => {
      const wrapper = mount(ConfigField, { props: { field, value: 0.4 } })
      try {
        for (const value of ['-0.1', '1.1', 'NaN', 'Infinity', '']) {
          await wrapper.find('input').setValue(value)
          expect(wrapper.find('[role=alert]').exists(), value).toBe(true)
          expect(wrapper.find('[role=slider]').attributes('aria-valuenow')).toBe('0.4')
          expect(wrapper.emitted('change')).toBeUndefined()
        }
        // A deliberate slider action repairs the invalid editor and submits its valid value.
        wrapper.findComponent(Slider).vm.$emit('change', 0.5)
        await wrapper.vm.$nextTick()
        expect(wrapper.find('[role=alert]').exists()).toBe(false)
        expect(wrapper.emitted('change')).toEqual([[0.5]])
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each(fields.map((field) => [field.path, field] as const))(
    'renders and submits %s through the Vue control',
    async (_path, field: FieldDefinition) => {
      if (field.kind === 'select' && !field.options?.length)
        field = { ...field, options: [{ label: 'Left', value: 'left' }] }
      const wrapper = mount(ConfigField, { props: { field, value: undefined } })
      const value =
        field.kind === 'boolean'
          ? true
          : field.kind === 'select'
            ? field.options![0].value
            : field.kind === 'color'
              ? '#123456'
              : field.kind === 'number' || field.kind === 'range'
                ? String(field.min ?? 1)
                : field.path.includes('tickFormat')
                  ? '.2f'
                  : field.path === 'width' || field.path === 'height'
                    ? '800'
                    : 'Example'
      if (field.kind === 'select') wrapper.findComponent(Select).vm.$emit('update:value', value)
      else if (field.kind === 'boolean') await wrapper.find('[role="switch"]').trigger('click')
      else await wrapper.find('input').setValue(value)
      expect(wrapper.emitted('change')?.length, field.path).toBeGreaterThan(0)
      expect(wrapper.find('[role=alert]').exists()).toBe(false)
      if (field.kind === 'range')
        expect(wrapper.find('[role=slider]').attributes('aria-label')).toBe(`${field.label}滑块`)
      wrapper.unmount()
    },
  )
})
