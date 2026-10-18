import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('discovers every suite exactly once, with demo suites only in the manual config', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict'
    import { readdirSync } from 'node:fs'
    import { resolve } from 'node:path'
    import { createVitest } from 'vitest/node'
    const discover = async (configFile) => {
      const ctx = await createVitest('test', { config: configFile, watch: false })
      try { return (await ctx.globTestSpecifications()).map(spec => spec.moduleId) }
      finally { await ctx.close() }
    }
    const library = await discover('vite.config.ts')
    const demo = await discover('vitest.demo.config.ts')
    const isDemo = file => file.includes('/demo-app/tests/') || file.includes('/tests/display/demo/')
    assert(library.length > 0 && demo.length > 0)
    assert(library.every(file => !isDemo(file)))
    assert(demo.every(isDemo))
    const all = [...library, ...demo].sort()
    assert.equal(new Set(all).size, all.length)
    const walk = root => readdirSync(root, { withFileTypes: true }).flatMap(entry => {
      if (entry.name === 'node_modules' || entry.isSymbolicLink()) return []
      const path = resolve(root, entry.name)
      return entry.isDirectory() ? walk(path) : entry.name.endsWith('.test.ts') ? [path] : []
    })
    const expected = ['tests', 'demo-app/tests'].flatMap(walk)
    assert.deepEqual(all, expected.sort())
  `,
    ],
    {
      encoding: 'utf8',
      timeout: 25_000,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('VITEST')),
      ),
    },
  )
  expect(result.status, result.stdout + result.stderr).toBe(0)
})

it('keeps demo browser checks out of release commands', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  expect(pkg.scripts['test:demo']).toContain('--config vitest.demo.config.ts')
  expect(pkg.scripts['test:demo:browser']).toContain('scripts/verify-demo-browser.mjs')
  expect(pkg.scripts['test:demo:browser']).toContain('scripts/verify-unified-demo.mjs')
  expect(pkg.scripts['test:demo:browser']).toContain('scripts/verify-public-controls-browser.mjs')
  expect(readFileSync('scripts/test-package.mjs', 'utf8')).not.toMatch(
    /verify-unified-demo|verify-public-controls-browser/,
  )
  expect(readFileSync('scripts/verify-update-quality-browser.mjs', 'utf8')).not.toContain(
    '/demo-app/',
  )
  for (const file of [
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml',
    '.github/workflows/browser-regression.yml',
    '.gitea/workflows/package.yml',
  ]) {
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /pnpm test:demo|verify-demo-browser|verify-unified-demo/,
    )
  }
})
