import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve('openspec/changes/integrate-waveform-display-and-component-demos/evidence')
const read = async (name) => JSON.parse(await readFile(resolve(root, name), 'utf8'))
const [baseline, integrated, budget] = await Promise.all([
  read('baseline-performance.json'),
  read('integrated-performance.json'),
  read('performance-budget.json'),
])
assert.deepEqual(baseline.errors, [])
assert.deepEqual(integrated.errors, [])
assert.equal(baseline.userAgent, integrated.userAgent)
assert.equal(baseline.build, integrated.build)
assert.equal(budget.maxInitMs, 'baseline * 1.5 + 8')
assert.equal(budget.maxFrameP95Ms, 'baseline * 1.5 + 8')
assert.equal(budget.maxHeapBytes, 'baseline * 1.5 + 8000000')
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const comparisons = []
for (const count of budget.pointCounts)
  for (const mode of budget.modes) {
    const before = baseline.samples.filter((row) => row.count === count && row.mode === mode)
    const after = integrated.samples.filter((row) => row.count === count && row.mode === mode)
    assert.equal(before.length, budget.repeats)
    assert.equal(after.length, budget.repeats)
    for (const row of [...before, ...after]) assert.equal(row.remainingSvg, 0)
    for (const [metric, slack] of [
      ['initMs', 8],
      ['frameP95Ms', 8],
      ['heap', 8000000],
    ]) {
      if (metric === 'frameP95Ms' && mode === 'display' && count === 12000) {
        assert.ok([...before, ...after].every((row) => row[metric] === null))
        comparisons.push({ count, mode, metric, status: 'expected static fallback' })
        continue
      }
      assert.ok([...before, ...after].every((row) => Number.isFinite(row[metric])))
      const previous = median(before.map((row) => row[metric]))
      const current = median(after.map((row) => row[metric]))
      const limit = previous * 1.5 + slack
      comparisons.push({
        count,
        mode,
        metric,
        baseline: previous,
        integrated: current,
        limit,
        passed: current <= limit,
      })
    }
  }
await writeFile(
  resolve(root, 'performance-comparison.json'),
  JSON.stringify(comparisons, null, 2) + '\n',
)
assert.ok(
  comparisons.every((row) => row.passed !== false),
  'Performance budget exceeded',
)
console.log(
  `${comparisons.length} scenario/metric comparisons passed (including documented static fallback)`,
)
