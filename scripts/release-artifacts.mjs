import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const basePath = '/waveform-analysis/'
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

function expectedFiles(version) {
  if (!/^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?$/.test(version)) throw new Error('Invalid version')
  const files = [`waveform-analysis-${version}.tgz`]
  if (!version.includes('-')) files.push(`waveform-demo-${version}.tar.gz`)
  return files.flatMap((name) => [name, `${name}.sha256`]).sort()
}

export function releaseManifest(directory, sha, version) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Expected a full commit SHA')
  const expected = expectedFiles(version)
  const actual = readdirSync(directory)
    .filter((name) => name !== 'verified-release.json')
    .sort()
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error('Unexpected release files')
  const files = Object.fromEntries(
    expected.map((name) => {
      const file = join(directory, name)
      if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())
        throw new Error('Expected regular files')
      return [name, digest(readFileSync(file))]
    }),
  )
  for (const name of expected.filter((name) => !name.endsWith('.sha256'))) {
    if (readFileSync(join(directory, `${name}.sha256`), 'utf8') !== `${files[name]}  ${name}\n`)
      throw new Error(`Checksum mismatch: ${name}`)
  }
  return { schemaVersion: 1, sha, version, demoBasePath: basePath, files }
}

export function verifyReleaseArtifacts(directory, sha, version) {
  const manifest = JSON.parse(readFileSync(join(directory, 'verified-release.json'), 'utf8'))
  const expected = releaseManifest(directory, sha, version)
  for (const field of ['schemaVersion', 'sha', 'version', 'demoBasePath']) {
    if (manifest[field] !== expected[field]) throw new Error(`Artifact ${field} mismatch`)
  }
  if (
    JSON.stringify(Object.entries(manifest.files ?? {}).sort()) !==
    JSON.stringify(Object.entries(expected.files).sort())
  )
    throw new Error('Artifact digest mismatch')
  const packed = JSON.parse(
    execFileSync(
      'tar',
      ['-xOf', join(directory, `waveform-analysis-${version}.tgz`), 'package/package.json'],
      { encoding: 'utf8' },
    ),
  )
  if (packed.name !== 'waveform-analysis' || packed.version !== version)
    throw new Error('Packed version mismatch')
  if (!version.includes('-')) {
    const archive = join(directory, `waveform-demo-${version}.tar.gz`)
    if (execFileSync('tar', ['-xOf', archive, 'version.txt'], { encoding: 'utf8' }).trim() !== sha)
      throw new Error('Demo commit mismatch')
    const index = execFileSync('tar', ['-xOf', archive, 'index.html'], { encoding: 'utf8' })
    if (!index.includes(`${basePath}assets/`) || index.includes('"/assets/'))
      throw new Error('Demo base path mismatch')
  }
  return expected
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, directory = 'release-assets'] = process.argv.slice(2)
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version
  const sha = process.env.GITHUB_SHA
  if (command === 'seal') {
    const manifest = releaseManifest(directory, sha, version)
    writeFileSync(
      join(directory, 'verified-release.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    )
  } else if (command !== 'verify') throw new Error('Expected seal or verify')
  verifyReleaseArtifacts(directory, sha, version)
  console.log(`Verified release artifacts for ${version} at ${sha}`)
}
