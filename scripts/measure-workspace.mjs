import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir, platform, release, cpus } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import ts from 'typescript'

// All installation stores are task-local. Never clear a contributor's shared store.
const label = process.argv[2] ?? 'baseline'
const output = resolve(`openspec/changes/project-optimization-2024/evidence/${label}.json`)
const resumed = process.argv.includes('--resume') && existsSync(output)
const previous = resumed ? JSON.parse(readFileSync(output, 'utf8')) : undefined
const temporary = previous?.temporary ?? mkdtempSync(join(tmpdir(), 'waveform-measure-'))
const pnpm = process.env.npm_execpath ?? process.argv[3]
if (!pnpm?.includes('pnpm')) throw new Error('Run through pnpm exec node.')
const result = previous ?? {
  label,
  date: new Date().toISOString(),
  node: process.version,
  machine: { platform: platform(), release: release(), cpu: cpus()[0].model },
  temporary,
  lockSha256: createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex'),
  commands: [],
  installations: [],
  builds: [],
}
if (previous) {
  result.commands = result.commands.filter((command) => command.exitCode === 0)
  result.builds = []
  result.installations = []
}
let commandIndex = 0
mkdirSync(dirname(output), { recursive: true })
const save = () => writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
function run(args, cwd = process.cwd()) {
  const existing = result.commands[commandIndex++]
  if (existing) {
    if (JSON.stringify(existing.args) !== JSON.stringify(args) || existing.cwd !== cwd) {
      throw new Error('Resume command differs from recorded measurement.')
    }
    return existing
  }
  const start = performance.now()
  const log = `${label}-${result.commands.length + 1}.txt`
  result.inProgress = { args, cwd, log }
  save()
  const descriptor = openSync(join(dirname(output), log), 'w')
  const execution = spawnSync(process.execPath, [pnpm, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', descriptor, descriptor],
    env: args[0] === 'pack' ? { ...process.env, npm_config_ignore_scripts: 'true' } : process.env,
  })
  closeSync(descriptor)
  const record = { args, cwd, exitCode: execution.status, ms: performance.now() - start }
  delete result.inProgress
  result.commands.push({ ...record, log })
  save()
  if (execution.status !== 0) throw new Error(`Failed: pnpm ${args.join(' ')}; see ${log}`)
  return record
}
function files(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : []
  })
}
function disk(root) {
  const paths = files(root)
  return {
    path: root,
    files: paths.length,
    logicalBytes: paths.reduce((n, p) => n + statSync(p).size, 0),
    symlinks: 'not followed; logical bytes, not allocated size',
  }
}
function artifacts() {
  const js = files('dist').filter((p) => /\.(js|cjs)$/.test(p))
  const gzip = (paths) => paths.reduce((n, p) => n + gzipSync(readFileSync(p)).length, 0)
  const entries = {}
  for (const entry of ['index', 'native', 'vue'])
    for (const ext of ['js', 'cjs']) {
      const seen = new Set()
      function visit(path) {
        path = resolve(path)
        if (seen.has(path)) return
        seen.add(path)
        const source = readFileSync(path, 'utf8')
        const parsed = ts.createSourceFile(
          path,
          source,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.JS,
        )
        function inspect(node) {
          const specifier =
            ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
              ? node.moduleSpecifier
              : ts.isCallExpression(node) &&
                  (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                    node.expression.getText(parsed) === 'require')
                ? node.arguments[0]
                : ts.isNewExpression(node) && node.expression.getText(parsed) === 'URL'
                  ? node.arguments?.[0]
                  : undefined
          if (
            specifier &&
            ts.isStringLiteralLike(specifier) &&
            /^(\.\/|\/assets\/|assets\/).*\.(js|cjs)$/.test(specifier.text)
          ) {
            visit(
              specifier.text.startsWith('/assets/')
                ? resolve('dist', specifier.text.slice(1))
                : resolve(dirname(path), specifier.text),
            )
          }
          ts.forEachChild(node, inspect)
        }
        inspect(parsed)
      }
      visit(`dist/${entry}.${ext}`)
      entries[`${entry}.${ext}`] = {
        files: [...seen].map((p) => p.replace(process.cwd(), '.')),
        gzipBytes: gzip([...seen]),
      }
    }
  const byExtension = {}
  for (const ext of ['css', 'wasm', 'd.ts'])
    byExtension[ext] = files('dist')
      .filter((p) => p.endsWith(`.${ext}`))
      .reduce((n, p) => n + statSync(p).size, 0)
  const inlineWasm = new Map()
  for (const path of js) {
    for (const match of readFileSync(path, 'utf8').matchAll(
      /data:application\/wasm;base64,([A-Za-z0-9+/=]+)/g,
    )) {
      const bytes = Buffer.from(match[1], 'base64')
      const hash = createHash('sha256').update(bytes).digest('hex')
      const record = inlineWasm.get(hash) ?? { sha256: hash, decodedBytes: bytes.length, files: [] }
      record.files.push(path)
      inlineWasm.set(hash, record)
    }
  }
  return {
    entries,
    allJsGzipBytes: gzip(js),
    byExtension,
    inlineWasm: [...inlineWasm.values()],
    dist: disk('dist'),
  }
}
if (!process.argv.includes('--install-only')) {
  if (!process.argv.includes('--skip-checks')) {
    for (const command of ['typecheck', 'check:file-length', 'lint:all', 'test:coverage']) {
      run(command === 'test:coverage' ? [command, '--maxWorkers=2'] : [command])
    }
  }
  for (let repetition = 1; repetition <= 3; repetition++) {
    const measurement = run(['build:lib'])
    run(['build:types'])
    result.builds.push({
      repetition,
      cache: 'warm dependencies; build:lib replaces dist; WASM separately prepared',
      ...measurement,
      artifacts: artifacts(),
    })
    save()
  }
  run(['build:demo'])
  run(['pack', '--pack-destination', temporary])
  result.tarball = files(temporary)
    .filter((p) => p.endsWith('.tgz'))
    .map((path) => ({ path, bytes: statSync(path).size }))
}
// Manifest-only fresh installs measure dependency acquisition/linking, excluding source/builds.
if (!process.argv.includes('--no-install')) {
  const scopeArgument = process.argv.find((argument) => argument.startsWith('--scope='))
  const scopes = scopeArgument
    ? [scopeArgument.slice('--scope='.length)]
    : ['workspace', 'library-dev', 'runtime']
  for (const scope of scopes)
    for (let repetition = 1; repetition <= 3; repetition++) {
      const store = join(temporary, `${scope}-${repetition}-store`)
      for (const cache of ['cold', 'hot']) {
        const cwd = join(temporary, `${scope}-${repetition}-${cache}`)
        mkdirSync(cwd, { recursive: true })
        for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
          if (existsSync(file)) cpSync(file, join(cwd, file))
        for (const pkg of ['demo-app', 'tests'])
          if (existsSync(`${pkg}/package.json`)) {
            mkdirSync(join(cwd, pkg), { recursive: true })
            cpSync(`${pkg}/package.json`, join(cwd, pkg, 'package.json'))
          }
        const args = [
          'install',
          '--frozen-lockfile',
          '--ignore-scripts',
          '--store-dir',
          store,
          '--reporter=append-only',
        ]
        if (scope === 'runtime') args.push('--prod', '--filter', 'waveform-analysis')
        if (scope === 'library-dev') args.push('--filter', 'waveform-analysis')
        const measurement = run(args, cwd)
        result.installations.push({
          scope,
          repetition,
          cache,
          ...measurement,
          disk: disk(join(cwd, 'node_modules')),
        })
        save()
      }
    }
}
result.disk = [disk('node_modules'), disk('dist'), disk('dist-demo')]
save()
console.log(`Measurements saved to ${output}`)
