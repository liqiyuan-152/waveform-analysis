import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { waitForReleaseAssets } from '../../scripts/release-ci.mjs'

const context = { repo: { owner: 'owner', repo: 'repo' }, sha: 'abc', ref: 'refs/tags/v1.0.0' }
const run = {
  id: 10,
  head_sha: 'abc',
  head_repository: { full_name: 'owner/repo' },
  event: 'push',
  status: 'completed',
  conclusion: 'success',
}
const artifact = { id: 20, name: 'verified-release-abc', expired: false }
function setup(runs = [run], artifacts = [artifact]) {
  const listWorkflowRuns = vi.fn()
  const createWorkflowDispatch = vi.fn()
  const github = {
    rest: {
      actions: { listWorkflowRuns, listWorkflowRunArtifacts: vi.fn(), createWorkflowDispatch },
    },
    paginate: vi.fn(async (method) => (method === listWorkflowRuns ? runs : artifacts)),
  }
  return { github, context, sleep: vi.fn(), attempts: 5 }
}

describe('release CI reuse', () => {
  it('reuses the verified artifact without dispatching or testing again', async () => {
    const options = setup()
    await expect(waitForReleaseAssets(options)).resolves.toEqual({ runId: 10, artifactId: 20 })
    expect(options.github.rest.actions.createWorkflowDispatch).not.toHaveBeenCalled()
    expect(options.github.paginate).toHaveBeenCalledWith(
      options.github.rest.actions.listWorkflowRuns,
      expect.objectContaining({ workflow_id: 'ci.yml', head_sha: 'abc' }),
    )
  })

  it('waits for an active CI run instead of starting another', async () => {
    const options = setup([{ ...run, status: 'in_progress' }])
    await expect(waitForReleaseAssets(options)).rejects.toThrow('Timed out')
    expect(options.github.rest.actions.createWorkflowDispatch).not.toHaveBeenCalled()
  })

  it.each(['failure', 'timed_out', 'action_required'])(
    'blocks release after %s',
    async (conclusion) => {
      const options = setup([{ ...run, conclusion }])
      await expect(waitForReleaseAssets(options)).rejects.toThrow('release blocked')
      expect(options.github.rest.actions.createWorkflowDispatch).not.toHaveBeenCalled()
    },
  )

  it.each([
    { ...run, head_sha: 'other' },
    { ...run, event: 'pull_request' },
    { ...run, head_repository: { full_name: 'fork/repo' } },
  ])('does not trust an unrelated run', async (unrelated) => {
    const options = setup([unrelated])
    await expect(waitForReleaseAssets(options)).rejects.toThrow('Timed out')
    expect(options.github.rest.actions.createWorkflowDispatch).toHaveBeenCalledTimes(1)
  })

  it.each([{ assets: [] }, { assets: [{ ...artifact, expired: true }] }])(
    'revalidates missing or expired assets',
    async ({ assets }) => {
      const options = setup([run], assets)
      await expect(waitForReleaseAssets(options)).rejects.toThrow('Timed out')
      expect(options.github.rest.actions.createWorkflowDispatch).toHaveBeenCalledExactlyOnceWith({
        ...context.repo,
        workflow_id: 'ci.yml',
        ref: 'v1.0.0',
      })
    },
  )

  it('accepts the completed fallback and ignores the older run', async () => {
    const options = setup([])
    const list = options.github.rest.actions.listWorkflowRuns
    options.github.paginate.mockImplementation(async (method) => {
      if (method !== list) return [artifact]
      return options.github.rest.actions.createWorkflowDispatch.mock.calls.length
        ? [{ ...run, id: 11, event: 'workflow_dispatch' }]
        : []
    })
    await expect(waitForReleaseAssets(options)).resolves.toEqual({ runId: 11, artifactId: 20 })
  })

  it('publishes only downloaded CI assets after checksum verification', () => {
    const source = readFileSync('.github/workflows/release.yml', 'utf8')
    expect(source).not.toMatch(/pnpm (test:coverage|build|test:package)/)
    expect(source.indexOf('Wait for verified CI assets')).toBeLessThan(
      source.indexOf('name: Publish'),
    )
    expect(source.indexOf('Verify downloaded release assets')).toBeLessThan(
      source.indexOf('name: Publish'),
    )
    expect(source).toContain('artifact-ids: ${{ steps.ci.outputs.artifact-id }}')
    expect(source).not.toContain('continue-on-error')
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
    expect(ci.indexOf('Retain verified release assets')).toBeGreaterThan(
      ci.indexOf('pnpm test:package'),
    )
    expect(ci).toContain('workflow_dispatch:')
  })
})
