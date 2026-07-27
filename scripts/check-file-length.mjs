import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const maximumLines = 400

export function physicalLineCount(contents) {
  if (contents.length === 0) return 0
  return contents.split('\n').length - Number(contents.endsWith('\n'))
}

export function isTextFile(contents) {
  return !contents.includes(0)
}

export function collectTextFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return collectTextFiles(path)
    if (!entry.isFile()) return []
    const contents = readFileSync(path)
    return isTextFile(contents) ? [{ path, contents: contents.toString('utf8') }] : []
  })
}

export function findFileLengthViolations(sourceRoot, limit = maximumLines) {
  return collectTextFiles(sourceRoot).flatMap(({ path, contents }) => {
    const lineCount = physicalLineCount(contents)
    if (lineCount <= limit) return []
    return [{ path: relative(process.cwd(), path), lineCount, limit }]
  })
}

function run() {
  const violations = findFileLengthViolations(resolve('src'))
  if (!violations.length) return
  console.error('Files exceed the source file length limit:')
  violations.forEach(({ path, lineCount, limit }) => {
    console.error(`  ${path}: ${lineCount} lines (maximum ${limit})`)
  })
  process.exitCode = 1
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entryPath) run()
