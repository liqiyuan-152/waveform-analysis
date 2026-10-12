import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const buildArguments = [
  'build',
  'wasm',
  '--target',
  'web',
  '--release',
  '--out-dir',
  'pkg',
  '--locked',
]

function filesBelow(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(root, entry.name)
      return entry.isDirectory() ? filesBelow(path) : entry.isFile() ? [path] : []
    })
    .sort()
}

function fingerprint(paths, metadata = '') {
  const hash = createHash('sha256').update(metadata)
  for (const path of paths) hash.update(path).update(readFileSync(path))
  return hash.digest('hex')
}

export function prepareWasm({ root = process.cwd(), force = false, run = execFileSync } = {}) {
  const stampPath = join(root, 'node_modules/.cache/waveform/wasm.json')
  const version = (tool, args) => String(run(tool, args, { cwd: root, encoding: 'utf8' }))
  const inputs = [
    ...filesBelow(join(root, 'wasm/src')),
    join(root, 'wasm/Cargo.toml'),
    join(root, 'wasm/Cargo.lock'),
    ...filesBelow(join(root, '.cargo')),
    ...filesBelow(join(root, 'wasm/.cargo')),
    ...[
      'rust-toolchain',
      'rust-toolchain.toml',
      'wasm/rust-toolchain',
      'wasm/rust-toolchain.toml',
      'wasm/build.rs',
    ]
      .map((p) => join(root, p))
      .filter(existsSync),
  ]
  const inputHash = fingerprint(
    inputs,
    JSON.stringify({
      buildArguments,
      rustc: version('rustc', ['-vV']),
      cargo: version('cargo', ['--version']),
      wasmPack: version('wasm-pack', ['--version']),
      env: Object.fromEntries(
        ['RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS', 'RUSTUP_TOOLCHAIN', 'CARGO_BUILD_TARGET'].map(
          (key) => [key, process.env[key] ?? ''],
        ),
      ),
    }),
  )
  const outputs = () => filesBelow(join(root, 'wasm/pkg'))
  const complete = () =>
    [
      'waveform_sampling_wasm.js',
      'waveform_sampling_wasm.d.ts',
      'waveform_sampling_wasm_bg.wasm',
      'waveform_sampling_wasm_bg.wasm.d.ts',
      'package.json',
    ].every((name) => existsSync(join(root, 'wasm/pkg', name)))
  let previous
  try {
    previous = JSON.parse(readFileSync(stampPath, 'utf8'))
  } catch {
    /* No trusted preparation record. */
  }
  if (
    !force &&
    complete() &&
    previous?.inputHash === inputHash &&
    previous.outputHash === fingerprint(outputs())
  ) {
    return { built: false }
  }
  run('wasm-pack', buildArguments, { cwd: root, stdio: 'inherit' })
  if (!complete()) throw new Error('WASM build did not produce all required package files.')
  mkdirSync(dirname(stampPath), { recursive: true })
  writeFileSync(stampPath, JSON.stringify({ inputHash, outputHash: fingerprint(outputs()) }))
  return { built: true }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = prepareWasm({ force: process.argv.includes('--force') })
  console.log(
    result.built ? 'WASM prepared.' : 'WASM preparation verified; reusing current artifacts.',
  )
}
