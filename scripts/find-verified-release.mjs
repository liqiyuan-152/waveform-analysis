import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function trustedRun(run, { repository, sha, branch }) {
  return (
    run.event === 'push' &&
    run.head_sha === sha &&
    run.head_branch === branch &&
    run.head_repository?.full_name === repository &&
    run.path === '.github/workflows/ci.yml'
  )
}

// Only successful default-branch push checks qualify. PR/manual runs cannot authorize publishing.
export async function findVerifiedRelease({
  repository,
  sha,
  branch,
  api,
  maxWaitMs = 900_000,
  intervalMs = 20_000,
  now = Date.now,
  delay = (ms) => new Promise((done) => setTimeout(done, ms)),
}) {
  const deadline = now() + maxWaitMs
  while (true) {
    const { workflow_runs: runs } = await api(
      `/repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`,
    )
    const candidates = runs.filter((run) => trustedRun(run, { repository, sha, branch }))
    for (const run of candidates) {
      if (run.status !== 'completed' || run.conclusion !== 'success') continue
      const { artifacts } = await api(
        `/repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`,
      )
      const artifact = artifacts.find(
        (item) =>
          item.name === `verified-release-${sha}` &&
          !item.expired &&
          item.workflow_run?.head_sha === sha,
      )
      if (artifact) return String(run.id)
    }
    if (!candidates.some((run) => run.status !== 'completed') || now() >= deadline) return ''
    console.log('Waiting for CI on the tagged commit to finish…')
    await delay(Math.min(intervalMs, deadline - now()))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let runId = ''
  try {
    runId = await findVerifiedRelease({
      repository: process.env.GITHUB_REPOSITORY,
      sha: process.env.GITHUB_SHA,
      branch: process.env.DEFAULT_BRANCH,
      api: async (path) => {
        const response = await fetch(
          `${process.env.GITHUB_API_URL ?? 'https://api.github.com'}${path}`,
          {
            signal: AbortSignal.timeout(15_000),
            headers: {
              Authorization: `Bearer ${process.env.GH_TOKEN}`,
              Accept: 'application/vnd.github+json',
            },
          },
        )
        if (!response.ok) throw new Error(`GitHub API returned ${response.status}`)
        return response.json()
      },
    })
  } catch (error) {
    console.log(`CI artifact lookup unavailable; full verification is required: ${error.message}`)
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `run-id=${runId}\n`)
  console.log(
    runId ? `Reuse verified CI run ${runId}` : 'No eligible CI artifact; run full verification',
  )
}
