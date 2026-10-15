import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { format, resolveConfig } from 'prettier'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const metadata = JSON.parse(
  execFileSync(
    'cargo',
    [
      'metadata',
      '--manifest-path',
      join(root, 'wasm/Cargo.toml'),
      '--format-version',
      '1',
      '--locked',
      '--offline',
    ],
    { encoding: 'utf8' },
  ),
)
const crates = metadata.packages
  .filter((entry) => entry.source !== null)
  .sort((a, b) => a.name.localeCompare(b.name))
const npmPackages = new Map()
function visitNpm(name, from = root) {
  const resolver = createRequire(join(from, 'package.json'))
  // package.json is not exported by every dependency, so resolve from its owner directory.
  let directory
  try {
    directory = dirname(resolver.resolve(`${name}/package.json`))
  } catch {
    directory = dirname(resolver.resolve(name))
    while (!readdirSync(directory).includes('package.json')) directory = dirname(directory)
  }
  const entry = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  const identity = `${entry.name}@${entry.version}`
  if (npmPackages.has(identity)) return
  assert.ok(entry.license, `Missing license declaration: ${identity}`)
  npmPackages.set(identity, { name: entry.name, version: entry.version, license: entry.license })
  for (const child of Object.keys(entry.dependencies || {})) visitNpm(child, directory)
}
for (const name of Object.keys(manifest.dependencies || {})) visitNpm(name)
const external = [...npmPackages.values()].sort((a, b) => a.name.localeCompare(b.name))
const lines = [
  '# Third-party notices',
  '',
  '本文件记录发布库使用的第三方代码；不指定本项目自身的许可证。',
  '由 `node scripts/check-third-party-notices.mjs --write` 根据锁定安装和 Cargo.lock 生成。',
  '',
  '## External npm dependencies',
  '',
  'D3 由消费者安装，未打包进库。类型包也保持外部依赖；各包自带完整许可证。',
  '以下包含 dependencies 的传递依赖，不包含 demo/测试开发依赖或可选 Vue peer。',
  '',
  '| Package | Version | License |',
  '| --- | --- | --- |',
  ...external.map((entry) => `| ${entry.name} | ${entry.version} | ${entry.license} |`),
  '',
  '## WebAssembly and generated bindings',
  '',
  '发布资产包含 Rust/WASM 采样器与 wasm-bindgen 生成绑定。',
  '以下保留锁定构建依赖（包括 proc-macro/构建期依赖）的通知；',
  'MIT OR Apache-2.0 双许可选择 MIT，unicode-ident 另保留 Unicode-3.0 通知。',
  '',
]
for (const entry of crates) {
  assert.ok(
    ['MIT OR Apache-2.0', '(MIT OR Apache-2.0) AND Unicode-3.0'].includes(entry.license),
    `Review changed crate license: ${entry.name}: ${entry.license}`,
  )
  lines.push(`### ${entry.name} ${entry.version}`, '', `Upstream: ${entry.repository}`, '')
  const directory = dirname(entry.manifest_path)
  const files = ['LICENSE-MIT']
  if (entry.license.includes('AND Unicode-3.0')) files.push('LICENSE-UNICODE')
  const notices = readdirSync(directory).filter((name) => /^(NOTICE|COPYRIGHT)(\.|$)/i.test(name))
  for (const name of [...files, ...notices]) {
    const content = readFileSync(join(directory, name), 'utf8').trim()
    lines.push(`#### ${name}`, '', '```text', content, '```', '')
  }
}
const destination = join(root, 'THIRD_PARTY_NOTICES.md')
const expected = await format(`${lines.join('\n').trim()}\n`, {
  ...(await resolveConfig(destination)),
  filepath: destination,
})
if (process.argv.includes('--write')) writeFileSync(destination, expected)
else assert.equal(readFileSync(destination, 'utf8'), expected, 'Regenerate third-party notices')
console.log(
  `Third-party notices verified: ${external.length} npm packages; ${crates.length} Rust crates`,
)
