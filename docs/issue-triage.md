# Issue triage agent

The repository uses `.github/workflows/issue-triage.yml` to classify new and updated issues.
The agent assigns labels from a fixed allowlist and may post one concise first response when an
issue is opened or reopened. It does not close issues, modify code, assign users, or merge pull
requests.

## Model configuration

Configure these values under **Settings → Secrets and variables → Actions**:

| Type               | Name          | Purpose                                                    |
| ------------------ | ------------- | ---------------------------------------------------------- |
| Secret             | `AI_API_KEY`  | API key for an OpenAI Chat Completions-compatible endpoint |
| Variable or secret | `AI_BASE_URL` | API base URL ending in `/v1`                               |
| Variable or secret | `AI_MODEL`    | Model name accepted by that endpoint                       |

When model configuration is absent or the request fails, the workflow applies conservative
keyword-based labels instead of failing the entire run.

Issue titles, bodies, and up to eight recent comments are sent to the configured model endpoint.
The script redacts common token and credential formats first, but reporters must still avoid
posting credentials, private URLs, authentication files, or sensitive logs in public issues.

## Triggers and commands

- Opening or reopening an issue runs classification and may post a first response.
- Editing an issue refreshes managed labels without posting another response.
- A maintainer can run the workflow manually with an issue number.
- `/bot help` shows the available commands.
- Maintainers can use `/bot triage`, `/bot summarize`, `/bot quiet`, and `/bot unquiet`.

The bot creates and manages only its documented labels. Existing unrelated labels are preserved.
