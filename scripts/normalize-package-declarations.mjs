import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'

/** Emit resolvable ESM declaration specifiers for Bundler and NodeNext consumers. */
export function normalizePackageDeclarations(root) {
  for (const entry of readdirSync(root, { recursive: true })) {
    if (!entry.endsWith('.d.ts')) continue
    const path = resolve(root, entry)
    let content = readFileSync(path, 'utf8')
    const file = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true)
    const edits = []
    const inspect = (node) => {
      if (
        ts.isStringLiteral(node) &&
        (ts.isImportDeclaration(node.parent) ||
          ts.isExportDeclaration(node.parent) ||
          (ts.isLiteralTypeNode(node.parent) && ts.isImportTypeNode(node.parent.parent)))
      ) {
        const value = node.text
        if ((value.startsWith('.') || value.startsWith('@/')) && !value.endsWith('.css')) {
          const base = value.startsWith('@/')
            ? resolve(root, value.slice(2))
            : resolve(dirname(path), value)
          const candidates = value.endsWith('.js')
            ? [base.slice(0, -3) + '.d.ts']
            : [base + '.d.ts', resolve(base, 'index.d.ts')]
          const target = candidates.find(existsSync)
          if (!target) throw new Error(`Unresolved declaration: ${entry}: ${value}`)
          let specifier = relative(dirname(path), target)
            .replaceAll('\\', '/')
            .replace(/\.d\.ts$/, '.js')
          if (!specifier.startsWith('.')) specifier = './' + specifier
          edits.push({ start: node.getStart(file), end: node.end, text: JSON.stringify(specifier) })
        }
      }
      ts.forEachChild(node, inspect)
    }
    inspect(file)
    for (const edit of edits.reverse())
      content = content.slice(0, edit.start) + edit.text + content.slice(edit.end)
    writeFileSync(path, content)
  }
}
