import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const directory = 'openspec/changes/add-animation-system/evidence/'
const source = process.argv[2] ?? `${directory}memory-controller-snapshot.json`
const output = process.argv[3] ?? `${directory}memory-controller-snapshot-attribution.json`
const bytes = readFileSync(source)
const report = JSON.parse(bytes)
assert.ok([3, 4].includes(report.methodologyVersion), 'Unsupported measurement methodology')
assert.ok(report.finished, 'Only completed measurements can be attributed')
assert.equal(report.errors.length, 0, 'Inspect measurement errors before attribution')

function processes(sample) {
  const totals = new Map()
  for (const process of sample.processes) {
    assert.ok(process.type, 'Process type must be recorded')
    totals.set(process.type, (totals.get(process.type) ?? 0) + process.footprintBytes)
  }
  return totals
}

function observation(sample) {
  return {
    footprintBytes: sample.footprintBytes,
    jsHeap: sample.jsHeap,
    dom: sample.dom,
    activeTasks: sample.activeTasks,
    unfinished: sample.activeTasks > 0,
  }
}

function growth(run) {
  if (report.methodologyVersion === 4) {
    assert.ok(run.observationMs >= run.minimumObservationMs)
    assert.ok(run.minimumObservationMs >= report.durationMs + 100)
    assert.ok(run.samples.length > 1)
    assert.equal(run.samples.at(-1).activeTasks, 0, 'Natural observation must reach settlement')
    assert.equal(run.retainedAfterGC.activeTasks, 0, 'GC retention must be settled')
    for (const sample of run.samples) {
      assert.ok(sample.footprintStartedAt >= run.observationStartedAt)
      assert.ok(sample.footprintFinishedAt >= sample.footprintStartedAt)
      assert.ok(sample.footprintFinishedAt <= run.observationStartedAt + run.observationMs)
    }
    assert.equal(run.resources.tasks, 0)
    assert.equal(run.resources.elements, 0)
    assert.equal(run.afterCyclesBeforeGC.activeTasks, 0, 'Every run needs an unforced cycle sample')
    assert.equal(run.afterCycles.activeTasks, 0, 'Every run needs a post-GC cycle sample')
  }
  // Use all processes at the same global peak, not separate per-process maxima.
  const peak = run.samples.reduce((a, b) => (a.footprintBytes >= b.footprintBytes ? a : b))
  assert.equal(peak.footprintBytes, run.peakBytes)
  const before = processes(run.before)
  const during = processes(peak)
  const processGrowth = Object.fromEntries(
    [...new Set([...before.keys(), ...during.keys()])].map((type) => [
      type,
      (during.get(type) ?? 0) - (before.get(type) ?? 0),
    ]),
  )
  const physicalGrowth = peak.footprintBytes - run.before.footprintBytes
  return {
    ...(report.methodologyVersion === 4
      ? {
          coverage: {
            samples: run.samples.length,
            observationMs: run.observationMs,
            minimumObservationMs: run.minimumObservationMs,
            terminalTasks: run.samples.at(-1).activeTasks,
          },
        }
      : {}),
    physicalGrowth,
    processGrowth,
    observations: {
      before: observation(run.before),
      globalPhysicalPeak: observation(peak),
      afterForcedGC: observation(run.retainedAfterGC),
      ...(run.afterCyclesBeforeGC
        ? { afterTwentyUnmountCyclesBeforeGC: observation(run.afterCyclesBeforeGC) }
        : {}),
      ...(run.afterCycles ? { afterTwentyUnmountCycles: observation(run.afterCycles) } : {}),
    },
    // footprint's shared-page accounting means totals need not equal the process sum.
    totalAdjustment: physicalGrowth - Object.values(processGrowth).reduce((a, b) => a + b, 0),
    heapGrowth: Object.fromEntries(
      Object.keys(peak.jsHeap).map((key) => [key, peak.jsHeap[key] - run.before.jsHeap[key]]),
    ),
  }
}

const scenarios = report.scenarios.map((scenario) => ({
  width: scenario.width,
  height: scenario.height,
  series: scenario.series,
  points: scenario.points,
  mode: scenario.mode,
  runs: scenario.runs.map((run) => {
    const disabled = growth(run.staticRun)
    const enabled = growth(run.animatedRun)
    const types = new Set([
      ...Object.keys(disabled.processGrowth),
      ...Object.keys(enabled.processGrowth),
    ])
    const processIncrement = Object.fromEntries(
      [...types].map((type) => [
        type,
        (enabled.processGrowth[type] ?? 0) - (disabled.processGrowth[type] ?? 0),
      ]),
    )
    const totalAdjustmentIncrement = enabled.totalAdjustment - disabled.totalAdjustment
    assert.equal(enabled.physicalGrowth - disabled.physicalGrowth, run.animationIncrementBytes)
    assert.equal(
      Object.values(processIncrement).reduce((a, b) => a + b, 0) + totalAdjustmentIncrement,
      run.animationIncrementBytes,
    )
    return { disabled, enabled, processIncrement, totalAdjustmentIncrement }
  }),
}))
writeFileSync(
  output,
  JSON.stringify(
    {
      source,
      methodologyVersion: report.methodologyVersion,
      runnerSha256: report.runnerSha256,
      diagnosticOnly: !!report.diagnosticOnly,
      validForBudgetAcceptance: false,
      sourceSha256: createHash('sha256').update(bytes).digest('hex'),
      buildInputsSha256: report.buildInputsSha256,
      methodology:
        'Reconciles existing paired physical measurements at each run global peak. Process increments plus total adjustment equal the reported physical increment. CDP heap fields overlap native memory and each other; do not sum them or substitute them for physical acceptance. afterForcedGC can still have active tasks: it is not a settled or unmounted leak check. Only afterTwentyUnmountCycles is an unmounted observation, and only when activeTasks is zero. No new measurement or budget claim.',
      scenarios,
    },
    null,
    2,
  ) + '\n',
)
console.log(`Attributed ${scenarios.length} completed scenarios to ${output}`)
