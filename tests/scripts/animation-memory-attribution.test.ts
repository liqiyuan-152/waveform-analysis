import { afterEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

function sample(bytes: number, tasks = 0, time = 1000) {
  return {
    footprintStartedAt: time,
    footprintFinishedAt: time + 10,
    footprintBytes: bytes,
    processes: [
      { type: 'renderer', footprintBytes: bytes - 40 },
      { type: 'GPU', footprintBytes: 30 },
    ],
    jsHeap: { usedSize: 10, totalSize: 20 },
    dom: { documents: 1, nodes: 0, jsEventListeners: 0 },
    activeTasks: tasks,
  }
}
function run(peak: number) {
  return {
    before: sample(100),
    samples: [sample(peak - 10, 1), sample(peak, 0, 3200)],
    retainedAfterGC: sample(120),
    peakBytes: peak,
    observationStartedAt: 1000,
    minimumObservationMs: 2100,
    observationMs: 2210,
    afterCyclesBeforeGC: sample(150),
    afterCycles: sample(110),
    resources: { tasks: 0, elements: 0 },
  }
}
function report() {
  return {
    methodologyVersion: 4,
    finished: '2026-10-13T00:00:00Z',
    errors: [],
    durationMs: 2000,
    scenarios: [
      {
        width: 360,
        height: 300,
        series: 8,
        points: 10000,
        mode: 'compatible',
        runs: [{ staticRun: run(140), animatedRun: run(180), animationIncrementBytes: 40 }],
      },
    ],
  }
}
function attribute(input: ReturnType<typeof report>) {
  const directory = mkdtempSync(join(tmpdir(), 'waveform-memory-attribution-test-'))
  directories.push(directory)
  const source = join(directory, 'input.json')
  const output = join(directory, 'output.json')
  writeFileSync(source, JSON.stringify(input))
  const result = spawnSync(
    process.execPath,
    ['scripts/animation-memory-attribution.mjs', source, output],
    { encoding: 'utf8' },
  )
  return {
    result,
    read: () => JSON.parse(readFileSync(output, 'utf8')),
  }
}

describe('physical memory attribution evidence', () => {
  it('reconciles same-peak process growth and keeps GC retention separate from natural peak', () => {
    const { result, read } = attribute(report())
    expect(result.status, result.stderr).toBe(0)
    const evidence = read()
    const row = evidence.scenarios[0].runs[0]
    expect(row.processIncrement).toEqual({ renderer: 40, GPU: 0 })
    expect(row.totalAdjustmentIncrement).toBe(0)
    expect(row.enabled.coverage).toEqual({
      samples: 2,
      observationMs: 2210,
      minimumObservationMs: 2100,
      terminalTasks: 0,
    })
    expect(row.enabled.observations.globalPhysicalPeak.footprintBytes).toBe(180)
    expect(row.enabled.observations.afterForcedGC.footprintBytes).toBe(120)
    expect(row.enabled.observations.afterTwentyUnmountCyclesBeforeGC.footprintBytes).toBe(150)
    expect(row.enabled.observations.afterTwentyUnmountCycles.footprintBytes).toBe(110)
    expect(evidence.validForBudgetAcceptance).toBe(false)
  })

  it('retains support for historical v3 without implying full-window coverage', () => {
    const input = report()
    input.methodologyVersion = 3
    input.scenarios[0].runs[0].animatedRun.observationMs = 0
    const { result, read } = attribute(input)
    expect(result.status, result.stderr).toBe(0)
    expect(read().scenarios[0].runs[0].enabled.coverage).toBeUndefined()
    expect(read().validForBudgetAcceptance).toBe(false)
  })

  it.each(['window', 'settlement', 'cycle sample', 'peak', 'unfinished'])(
    'rejects incomplete or inconsistent %s evidence',
    (failure) => {
      const input = report()
      const run = input.scenarios[0].runs[0].animatedRun
      if (failure === 'window') run.observationMs = 1000
      if (failure === 'settlement') run.samples.at(-1)!.activeTasks = 1
      if (failure === 'cycle sample') Reflect.deleteProperty(run, 'afterCyclesBeforeGC')
      if (failure === 'peak') run.peakBytes = 190
      if (failure === 'unfinished') input.finished = ''
      expect(attribute(input).result.status).not.toBe(0)
    },
  )
})
