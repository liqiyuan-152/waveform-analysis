import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { releaseManifest, verifyReleaseArtifacts } from '../../scripts/release-artifacts.mjs'
import { findVerifiedRelease, trustedRun } from '../../scripts/find-verified-release.mjs'

const sha = 'a'.repeat(40)
const roots: string[] = []
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))

function fixture(version = '1.2.3', packedVersion = version, demoSha = sha) {
  const root = mkdtempSync(join(tmpdir(), 'verified-release-'))
  roots.push(root)
  const assets = join(root, 'assets')
  mkdirSync(assets)
  mkdirSync(join(root, 'package'))
  writeFileSync(
    join(root, 'package/package.json'),
    JSON.stringify({ name: 'waveform-analysis', version: packedVersion }),
  )
  const pack = (name: string, files: string[]) => {
    const file = join(assets, name)
    execFileSync('tar', ['-czf', file, '-C', root, ...files])
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex')
    writeFileSync(`${file}.sha256`, `${digest}  ${name}\n`)
  }
  pack(`waveform-analysis-${version}.tgz`, ['package'])
  if (!version.includes('-')) {
    writeFileSync(join(root, 'version.txt'), `${demoSha}\n`)
    writeFileSync(
      join(root, 'index.html'),
      '<script src="/waveform-analysis/assets/main.js"></script>',
    )
    pack(`waveform-demo-${version}.tar.gz`, ['version.txt', 'index.html'])
  }
  writeFileSync(
    join(assets, 'verified-release.json'),
    JSON.stringify(releaseManifest(assets, sha, version)),
  )
  return assets
}

describe('verified release assets', () => {
  it.each(['1.2.3', '1.2.3-rc.1'])('accepts the exact commit and package for %s', (version) => {
    expect(verifyReleaseArtifacts(fixture(version), sha, version).sha).toBe(sha)
  })
  it('rejects a different commit or version before consuming the package', () => {
    const assets = fixture()
    expect(() => verifyReleaseArtifacts(assets, 'b'.repeat(40), '1.2.3')).toThrow('sha mismatch')
    expect(() => verifyReleaseArtifacts(assets, sha, '1.2.4')).toThrow()
  })
  it('rejects modified files even when a new checksum file is supplied', () => {
    const assets = fixture()
    const name = 'waveform-analysis-1.2.3.tgz'
    const bytes = Buffer.from('replacement package')
    writeFileSync(join(assets, name), bytes)
    writeFileSync(
      join(assets, `${name}.sha256`),
      `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`,
    )
    expect(() => verifyReleaseArtifacts(assets, sha, '1.2.3')).toThrow('digest mismatch')
  })
  it('rejects a package or Demo whose contents disagree with its manifest', () => {
    expect(() => verifyReleaseArtifacts(fixture('1.2.3', '9.9.9'), sha, '1.2.3')).toThrow(
      'Packed version',
    )
    expect(() =>
      verifyReleaseArtifacts(fixture('1.2.3', '1.2.3', 'b'.repeat(40)), sha, '1.2.3'),
    ).toThrow('Demo commit')
  })
  it('rejects missing or extra files and a changed deployment path', () => {
    const assets = fixture()
    const manifest = JSON.parse(readFileSync(join(assets, 'verified-release.json'), 'utf8'))
    manifest.demoBasePath = '/'
    writeFileSync(join(assets, 'verified-release.json'), JSON.stringify(manifest))
    expect(() => verifyReleaseArtifacts(assets, sha, '1.2.3')).toThrow('demoBasePath')
    writeFileSync(join(assets, 'extra.tgz'), '')
    expect(() => releaseManifest(assets, sha, '1.2.3')).toThrow('Unexpected release files')
    rmSync(join(assets, 'extra.tgz'))
    rmSync(join(assets, 'waveform-demo-1.2.3.tar.gz'))
    expect(() => releaseManifest(assets, sha, '1.2.3')).toThrow('Unexpected release files')
  })
})

describe('trusted CI selection', () => {
  const identity = { repository: 'owner/repo', sha, branch: 'main' }
  const run = {
    id: 123,
    head_sha: sha,
    event: 'push',
    head_branch: 'main',
    head_repository: { full_name: 'owner/repo' },
    path: '.github/workflows/ci.yml',
    status: 'completed',
    conclusion: 'success',
  }
  const artifact = {
    name: `verified-release-${sha}`,
    expired: false,
    workflow_run: { head_sha: sha },
  }
  it.each([
    { event: 'pull_request' },
    { event: 'workflow_dispatch' },
    { head_sha: 'b'.repeat(40) },
    { head_branch: 'feature' },
    { head_repository: { full_name: 'attacker/repo' } },
    { path: '.github/workflows/other.yml' },
  ])('rejects mismatched run metadata: %j', (change) => {
    expect(trustedRun({ ...run, ...change }, identity)).toBe(false)
  })
  it('uses only a successful run with an unexpired artifact for the same commit', async () => {
    const api = async (path: string) =>
      path.includes('/artifacts?')
        ? { artifacts: [{ ...artifact, expired: true }, artifact] }
        : { workflow_runs: [{ ...run, id: 99, conclusion: 'failure' }, run] }
    expect(await findVerifiedRelease({ ...identity, api, maxWaitMs: 0 })).toBe('123')
  })
  it('falls back when success has no matching artifact', async () => {
    const api = async (path: string) =>
      path.includes('/artifacts?')
        ? { artifacts: [{ ...artifact, expired: true }] }
        : { workflow_runs: [run] }
    expect(await findVerifiedRelease({ ...identity, api, maxWaitMs: 0 })).toBe('')
  })
  it('waits for running CI instead of starting duplicate verification', async () => {
    let elapsed = 0
    const api = async (path: string) =>
      path.includes('/artifacts?')
        ? { artifacts: [artifact] }
        : { workflow_runs: [{ ...run, status: elapsed ? 'completed' : 'in_progress' }] }
    expect(
      await findVerifiedRelease({
        ...identity,
        api,
        maxWaitMs: 100,
        intervalMs: 10,
        now: () => elapsed,
        delay: async (ms: number) => {
          elapsed += ms
        },
      }),
    ).toBe('123')
    expect(elapsed).toBe(10)
  })
  it('bounds waiting and falls back when CI does not finish', async () => {
    let elapsed = 0
    const api = async () => ({ workflow_runs: [{ ...run, status: 'queued' }] })
    expect(
      await findVerifiedRelease({
        ...identity,
        api,
        maxWaitMs: 10,
        now: () => elapsed,
        delay: async (ms: number) => {
          elapsed += ms
        },
      }),
    ).toBe('')
    expect(elapsed).toBe(10)
  })
})
