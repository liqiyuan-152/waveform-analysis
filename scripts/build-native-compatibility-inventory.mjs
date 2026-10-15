import ts from 'typescript'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const directory = resolve('openspec/changes/decouple-waveform-engine-from-vue')
const baseline = JSON.parse(
  readFileSync(resolve(directory, 'evidence/public-api-baseline.json'), 'utf8'),
)
const config = ts.readConfigFile('tsconfig.app.json', ts.sys.readFile).config
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd())
const program = ts.createProgram(parsed.fileNames, parsed.options)
const checker = program.getTypeChecker()
const moduleExports = (path) => {
  const entry = program.getSourceFile(resolve(path))
  if (!entry) throw new Error(`Public entry missing from TypeScript program: ${path}`)
  const symbol = checker.getSymbolAtLocation(entry)
  return new Map(checker.getExportsOfModule(symbol).map((item) => [item.name, item]))
}
const exports = moduleExports('src/index.ts')
const nativeExports = moduleExports('src/native.ts')
const vueExports = moduleExports('src/vue.ts')
const resolveSymbol = (symbol) =>
  symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
const tests = execFileSync('rg', ['--files', 'tests'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((path) => path.endsWith('.test.ts'))
  .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
const defaultTests = (item) => {
  if (item.typeOnly)
    return ['tests/types/nativeContract.test.ts', 'scripts/verify-native-package.mjs']
  if (item.module.startsWith('./animation'))
    return ['tests/animation/presetsController.test.ts', 'tests/animation/engine.test.ts']
  if (item.module.startsWith('./core'))
    return [
      'tests/core/data.test.ts',
      'tests/core/rendering.test.ts',
      'tests/core/wasmSampling.test.ts',
    ]
  if (item.module.startsWith('./utils'))
    return ['tests/utils/domain.test.ts', 'tests/utils/formatters.test.ts']
  if (item.module.includes('annotation'))
    return ['tests/components/annotation/serialization.test.ts']
  return ['tests/components/waveformChartCases/dataLifecycle.test.ts']
}
const link = (path) => `[${path}](${relative(directory, resolve(path))})`
const rows = baseline.publicExports.map((item) => {
  const isComponent = item.name === 'WaveformChart'
  let current = (isComponent ? vueExports : exports).get(item.name)
  if (!current) throw new Error(`Public export disappeared: ${item.name}`)
  current = resolveSymbol(current)
  if (!isComponent && resolveSymbol(nativeExports.get(item.name)) !== current)
    throw new Error(`Native export missing or resolves to a different symbol: ${item.name}`)
  const declaration = current.declarations?.[0]
  const source = declaration
    ? relative(process.cwd(), declaration.getSourceFile().fileName)
    : `src/${item.module.replace(/^\.\//, '')}`
  const direct = tests
    .filter((test) => new RegExp(`\\b${item.name}\\b`).test(test.text))
    .map((test) => test.path)
  const associated = direct.length ? direct : defaultTests(item)
  return `| \`${item.name}\` | ${item.typeOnly ? '类型' : '运行时'} | ${isComponent ? '/vue' : 'root + /native'} | ${link(source)} | ${associated.map(link).join('<br>')} | ${direct.length ? '直接引用' : '所属能力/声明检查'} |`
})
const text = `## Purpose

原始公共 API 快照来自 \`evidence/public-api-baseline.json\`（${baseline.commit}）。本表列出全部 ${rows.length} 个原始出口及当前源码/测试关联，由 \`scripts/build-native-compatibility-inventory.mjs\` 生成，不重写原始快照。

组件出口通过 /vue 追踪，其余原始出口必须同时存在于 root 与 /native，且解析到同一 TypeScript symbol；这项源码检查不代替最终产物的运行时身份检查。

“直接引用”表示测试文本出现该 symbol；“所属能力/声明检查”表示相关能力测试或完整声明图检查。两者均是追溯索引，不表示该 symbol 的所有原生行为已验收。完整图表能力仍须结合 compatibility.md、tasks.md 与浏览器结果逐项确认。

## Public Symbols

| Symbol | 类别 | 目标入口 | 当前源码 | 测试/验证关联 | 关联依据 |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`
writeFileSync(resolve(directory, 'symbol-inventory.md'), text)
console.log(`Recorded ${rows.length} original public exports with source and validation references`)
