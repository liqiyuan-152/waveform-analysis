interface CiRecord {
  id: number
  head_sha?: string
  head_repository?: { full_name: string }
  event?: string
  status?: string
  conclusion?: string | null
  name?: string
  expired?: boolean
}

export function waitForReleaseAssets(options: {
  github: {
    rest: {
      actions: {
        listWorkflowRuns: unknown
        listWorkflowRunArtifacts: unknown
        createWorkflowDispatch: (parameters: {
          owner: string
          repo: string
          workflow_id: string
          ref: string
        }) => Promise<unknown>
      }
    }
    paginate: (method: unknown, parameters: Record<string, unknown>) => Promise<CiRecord[]>
  }
  context: { repo: { owner: string; repo: string }; sha: string; ref: string }
  log?: (message: string) => void
  sleep?: (ms: number) => Promise<unknown>
  attempts?: number
}): Promise<{ runId: number; artifactId: number }>
