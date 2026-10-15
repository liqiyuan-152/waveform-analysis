import ts from 'typescript'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const directory = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
const read = (path) => readFileSync(path, 'utf8')
const parse = (path) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true)
const members = (path, name) => {
  const source = parse(path)
  const declaration = source.statements.find(
    (node) => ts.isInterfaceDeclaration(node) && node.name.text === name,
  )
  if (!declaration) throw new Error(`Missing ${name} in ${path}`)
  return declaration.members.map((member) => ({
    name: member.name?.getText(source),
    signature: member.getText(source),
    line: source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1,
  }))
}
const index = parse('src/index.ts')
const exports = index.statements.flatMap((node) => {
  if (!ts.isExportDeclaration(node) || !node.exportClause) return []
  if (!ts.isNamedExports(node.exportClause)) throw new Error('Unlisted wildcard export')
  return node.exportClause.elements.map((symbol) => ({
    name: symbol.name.text,
    original: symbol.propertyName?.text ?? symbol.name.text,
    typeOnly: node.isTypeOnly || symbol.isTypeOnly,
    module: node.moduleSpecifier.text,
  }))
})
const paths = [
  'src/index.ts',
  'src/components/WaveformChart.vue',
  'src/components/core/waveformChartTypes.ts',
  'src/types/controls.ts',
  'src/animation/types.ts',
  'src/components/annotation/serialization.ts',
  'package.json',
  'pnpm-lock.yaml',
]
const report = {
  capturedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  publicExports: exports,
  props: members(paths[2], 'WaveformChartProps'),
  animationProps: members(paths[4], 'WaveformAnimationProps'),
  events: members(paths[2], 'WaveformChartEmit'),
  handle: members(paths[3], 'WaveformChartHandle'),
  defaultsSource: read(paths[1]),
  annotationSerializationSource: read(paths[5]),
  trackedDiff: execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }),
  untrackedPaths: execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n'),
  inputs: Object.fromEntries(
    paths.map((path) => [path, createHash('sha256').update(read(path)).digest('hex')]),
  ),
}
mkdirSync(directory, { recursive: true })
// Exclusive creation prevents a later run from accidentally replacing the pre-migration baseline.
writeFileSync(resolve(directory, 'public-api-baseline.json'), JSON.stringify(report, null, 2), {
  flag: 'wx',
})
console.log(`Captured ${exports.length} exports and ${report.events.length} event signatures`)
