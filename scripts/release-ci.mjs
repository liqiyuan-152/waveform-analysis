/** Reuse only this repository's push/manual CI for the exact release commit. */
export async function waitForReleaseAssets({
  github,
  context,
  log = () => {},
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  attempts = 160,
}) {
  const repo = context.repo
  const sha = context.sha
  const name = `verified-release-${sha}`
  let dispatched = false
  let ignored = new Set()
  for (let attempt = 0; attempt < attempts; attempt++) {
    const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
      ...repo,
      workflow_id: 'ci.yml',
      head_sha: sha,
      per_page: 100,
    })
    const eligible = runs
      .filter(
        (run) =>
          run.head_sha === sha &&
          run.head_repository?.full_name === `${repo.owner}/${repo.repo}` &&
          ['push', 'workflow_dispatch'].includes(run.event) &&
          !ignored.has(run.id),
      )
      .sort((a, b) => b.id - a.id)
    const run = eligible[0]
    if (run?.status === 'completed' && run.conclusion === 'success') {
      const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
        ...repo,
        run_id: run.id,
        per_page: 100,
      })
      const artifact = artifacts.find((item) => item.name === name && !item.expired)
      if (artifact) {
        log(`Reusing verified CI run ${run.id} for ${sha}`)
        return { runId: run.id, artifactId: artifact.id }
      }
    } else if (run?.status === 'completed' && run.conclusion !== 'cancelled') {
      throw new Error(`CI run ${run.id} ended with ${run.conclusion}; release blocked`)
    } else if (run && run.status !== 'completed') {
      log(`Waiting for CI run ${run.id} (${run.status})`)
      await sleep(15_000)
      continue
    }
    // Give a simultaneous branch push time to appear before dispatching a fallback.
    if (!dispatched && (run || attempt >= 2)) {
      ignored = new Set(runs.map((item) => item.id))
      await github.rest.actions.createWorkflowDispatch({
        ...repo,
        workflow_id: 'ci.yml',
        ref: context.ref.replace(/^refs\/(tags|heads)\//, ''),
      })
      dispatched = true
      log(`Requested CI for ${context.ref}; waiting for verified assets`)
    }
    await sleep(15_000)
  }
  throw new Error(`Timed out waiting for verified CI assets for ${sha}; release blocked`)
}
