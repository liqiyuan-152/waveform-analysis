import ts from 'typescript'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const seen = new Set()
const violations = []
function visit(file) {
  if (seen.has(file)) return
  seen.add(file)
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const imports = []
  function inspect(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text)
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      if (ts.isStringLiteral(node.argument.literal)) imports.push(node.argument.literal.text)
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    )
      imports.push(node.arguments[0].text)
    ts.forEachChild(node, inspect)
  }
  inspect(source)
  for (const dependency of imports) {
    if (/^(vue(?:$|\/|-)|@vue\/|react(?:$|\/|-)|ant-design-vue|vue3-colorpicker)/.test(dependency))
      violations.push(`${file}: ${dependency}`)
    if (dependency.endsWith('.vue')) violations.push(`${file}: ${dependency}`)
    if (!dependency.startsWith('.') && !dependency.startsWith('@/')) continue
    const base = dependency.startsWith('@/')
      ? resolve('src', dependency.slice(2))
      : resolve(dirname(file), dependency)
    if (!base.startsWith(`${resolve('src')}/`) && !base.startsWith(`${resolve('wasm/pkg')}/`))
      violations.push(`${file}: dependency outside production source: ${dependency}`)
    const target = [
      base,
      `${base}.ts`,
      `${base}.d.ts`,
      `${base}.js`,
      resolve(base, 'index.ts'),
    ].find((path) => existsSync(path) && statSync(path).isFile())
    if (!target) throw new Error(`Cannot resolve ${dependency} from ${file}`)
    if (target.endsWith('.ts')) visit(target)
  }
}
visit(resolve('src/native.ts'))
// Shared presentation owners must stay framework-free before native instance wiring lands.
visit(resolve('src/animation/presentation/PaginationPresentation.ts'))
visit(resolve('src/animation/presentation/WaveformPresentation.ts'))
function visitStyles(file) {
  if (seen.has(file)) return
  seen.add(file)
  const source = readFileSync(file, 'utf8')
  if (/:global\(|:deep\(/.test(source)) violations.push(`${file}: Vue-only CSS selector`)
  for (const match of source.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) violations.push(`${file}: external style ${match[1]}`)
    else visitStyles(resolve(dirname(file), match[1]))
  }
}
visitStyles(resolve('src/styles/native.css'))
// Adapters and retained compatibility helpers must never depend on the historical oracle.
for (const entry of readdirSync(resolve('src'), { recursive: true })) {
  if (!/\.(?:ts|tsx|vue|css)$/.test(entry)) continue
  const file = resolve('src', entry)
  const source = readFileSync(file, 'utf8')
  if (
    /(?:from\s*|import\s*\(?|@import\s*)['"][^'"]*(?:@tests\/|tests\/fixtures\/legacy)/.test(source)
  )
    violations.push(`${file}: historical test fixture dependency`)
}
if (violations.length) throw new Error(`Native boundary violations:\n${violations.join('\n')}`)
console.log(`Native runtime and declaration source boundary verified (${seen.size} modules).`)
