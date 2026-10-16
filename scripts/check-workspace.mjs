import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const manifest = (path) => JSON.parse(readFileSync(path, 'utf8'))
const root = manifest('package.json')
const demo = manifest('demo-app/package.json')
const tests = manifest('tests/package.json')
assert.equal(demo.private, true)
assert.equal(tests.private, true)
assert.equal(demo.dependencies['waveform-analysis'], 'workspace:*')
const ui = ['ant-design-vue', 'vue3-colorpicker', 'vue-router'].map((name) => ({
  name,
  root: existsSync(`node_modules/${name}`),
  demo: existsSync(`demo-app/node_modules/${name}`),
}))
assert.ok(
  ui.every((entry) => !entry.root && entry.demo),
  'UI dependencies must belong to demo',
)
const imports = []
for (const file of readdirSync('demo-app/src', { recursive: true })) {
  if (!/\.(?:ts|vue)$/.test(file)) continue
  const contents = readFileSync(`demo-app/src/${file}`, 'utf8')
  const script = file.endsWith('.vue')
    ? (contents.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '')
    : contents
  const source = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true)
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue
    const specifier = node.moduleSpecifier.text
    if (specifier.startsWith('.') || specifier.startsWith('@/')) continue
    const name = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0]
    assert.ok(demo.dependencies[name] || demo.devDependencies[name], `${file}: undeclared ${name}`)
    if (name === 'waveform-analysis')
      assert.ok(
        ['waveform-analysis', 'waveform-analysis/vue', 'waveform-analysis/style.css'].includes(
          specifier,
        ),
        `${file}: private import ${specifier}`,
      )
    imports.push({ file, specifier })
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      runtimeDependencies: root.dependencies,
      peers: root.peerDependencies,
      demoPrivate: demo.private,
      testsPrivate: tests.private,
      ui,
      imports,
      lockSha256: createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex'),
    },
    null,
    2,
  ),
)
