# Architecture

## Context

`openspec-flow` already exists as a working implementation inside the livedown repo:

- `livedown/.github/workflows/openspec-flow.yaml` — 1079 lines, the orchestration workflow
- `livedown/.github/actions/openspec-flow-*/` — 8 composite actions: `run-agent`, `preflight`, `postflight`, `inject-usage-table`, `flip-label`, `handle-failure`, `prune-comments`, `raise-comment`
- `livedown/openspec/specs/openspec-flow/spec.md` — behavioural spec (191 lines)
- `livedown/openspec/specs/openspec-flow-composite-actions/spec.md` — composite-action contract
- `livedown/openspec/specs/preflight-agent-checks/` + `postflight-agent-checks/` + `pr-usage-table/` — supporting specs
- CHANGELOG 0.1.3–0.1.5 is mostly openspec-flow hardening

**This project is an extraction, not a greenfield build.** The first job is lifting that working code out of livedown into its own repo and shipping it as something other repos can install.

## Goals (short-term)

- Spec PR opened in response to an issue labeled `openspec:go`
- Implementation PR opened after the spec PR merges
- Bot iterates on either PR when a user comments
- Kicks off existing CI workflows in target repos
- No customisation surface — uses base openspec or the target repo's `openspec/config.yaml` as-is

## Distribution: ship two install modes

```
                  ┌──────────────────────────────┐
                  │      Target repository       │
                  └──────────────┬───────────────┘
                                 │ user labels issue
                                 ▼
        ┌────────────────────────────────────────────────┐
        │                                                │
        ▼                                                ▼
  ╔══════════════════╗                          ╔════════════════╗
  ║ Mode A: Action   ║                          ║ Mode B: App    ║
  ║ (install local)  ║                          ║ (org install)  ║
  ╠══════════════════╣                          ╠════════════════╣
  ║ workflow YAML    ║                          ║ Probot service ║
  ║ in target repo   ║                          ║ on Fly.io      ║
  ║ runs in Actions  ║                          ║ webhook events ║
  ╚══════════════════╝                          ╚════════════════╝
        │                                                │
        └────────────────────┬───────────────────────────┘
                             ▼
                  ┌──────────────────────┐
                  │  Same core logic:    │
                  │  • openspec CLI      │
                  │  • Claude execution  │
                  │  • git + gh actions  │
                  └──────────────────────┘
```

### Mode A — Action install (Phase 1, ship first)

The user copies one reusable-workflow shim into their repo:

```yaml
# .github/workflows/openspec-flow.yml in target repo
name: openspec-flow
on:
  issues: { types: [labeled] }
  issue_comment: { types: [created] }
  pull_request_review_comment: { types: [created] }
jobs:
  flow:
    uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      OPENSPEC_FLOW_APP_ID: ${{ secrets.OPENSPEC_FLOW_APP_ID }}
      OPENSPEC_FLOW_PRIVATE_KEY: ${{ secrets.OPENSPEC_FLOW_PRIVATE_KEY }}
```

The real logic lives in this repo's reusable workflow + composite actions, lifted from livedown.

Pros: zero infrastructure, free on public repos, near-zero install cost.
Cons: 20–60s runner cold start; `GITHUB_TOKEN` can't update workflow files (see below).

### Mode B — App install (Phase 2)

Register `openspec-flow` as a GitHub App. Users click "Install" on the org/repo. Service runs on Fly.io as a Probot process. Same composite-action logic, called from in-process TypeScript instead of from a runner.

Pros: `openspec-flow[bot]` identity, sub-10s response, can update workflow files, central upgrade path.
Cons: hosting bill (~$3–7/mo on Fly.io), secrets management, more moving parts.

## create-spec handler — agent / bot split

The `create-spec` handler is the first real beat. Two parts:

- **Agent (Claude Agent SDK)** drafts the OpenSpec change. Runs in a cloned target repo, uses the `openspec-new-change` skill that the target repo ships under `.claude/skills/`. Fetches issue context itself via `gh issue view --comments`.
- **Bot (handler code)** does the deterministic mechanics: clones the repo, configures git identity, validates preconditions, runs the agent, then branches / commits / pushes / opens the PR via Octokit / labels it `openspec:spec` / comments the PR number back on the issue.

The split keeps the prompt small, keeps Claude away from `GH_TOKEN` for PR creation (the bot owns Octokit auth), and makes failure modes predictable. Branch slug + commit message + PR body metadata block are all derived in code, never from Claude's output.

Failure surface: any exception inside the handler turns into one comment on the originating issue (`❌ openspec-flow couldn't open a spec PR: <error>`) and the workdir is removed unless `OPENSPEC_FLOW_KEEP_WORKDIR=true`.

### Workdir lifecycle

Each invocation gets its own ephemeral checkout at `$OPENSPEC_FLOW_WORKDIR/<issue-N>-<unix-ts>` (default base `/tmp/openspec-flow`). Cloned shallow (`--depth 50`), removed on exit. Keep with `OPENSPEC_FLOW_KEEP_WORKDIR=true` for post-mortem.

### Auth surfaces

| Mode | Octokit | Token for git push + agent's `GH_TOKEN` |
|---|---|---|
| App / Probot | `context.octokit` (per-event installation token) | minted via `context.octokit.auth({ type: "installation" })` |
| CLI / local | `Octokit` constructed from `gh auth token` | same `gh auth token` value |
| Action (future) | `Octokit` from `GITHUB_TOKEN` | same `GITHUB_TOKEN` |

Claude never sees the token directly. The handler passes it as `GH_TOKEN` env to the agent's Bash subprocess so `gh issue view --comments` succeeds without a login prompt.

### Why the bot owns git + PR mechanics

Anything deterministic (branch naming, commit format, PR body metadata block, labelling) is shipped by code. Anything that needs reading and drafting (issue context → OpenSpec artefacts) is the agent's job. This minimises Claude's tool surface, eliminates token exposure for the PR step, and means a single regex/format change ripples to one place — not a re-prompt.

## Framework choice

**Probot** (TypeScript, v14.3.2 as of April 2026). Actively maintained, wraps `@octokit/app` + `@octokit/webhooks`, handles JWT auth and per-installation tokens, has built-in fixture replay (`probot receive`). Smaller projects use raw `@octokit/app` + Hono but Probot saves ~500 lines of plumbing and is well-trodden.

**LLM layer:** `anthropics/claude-code-action@v1` inside the Action; `@anthropic-ai/claude-agent-sdk` (TypeScript) in-process for the Probot App. Both call Claude Code under the hood. The Action covers ~60% of the use case out of the box — label trigger, headless Claude, comment threading — but cannot yet auto-create PRs or modify workflow files. The remaining 40% is what livedown's composite actions already implement.

**Host:** Fly.io for Probot. Cloudflare Workers ruled out: no `child_process`, 128MB RAM, can't run Claude subprocesses.

## The `workflows: write` permission problem

The user has hit this. The default `GITHUB_TOKEN` does **not** carry `workflows: write` and cannot be granted it via the `permissions:` block — it's a token-minting-time restriction, not a workflow-scope one. So a workflow can never edit `.github/workflows/*.yml` using `GITHUB_TOKEN`. This makes "the bot self-updates its own workflow file" hard.

Production-safe workaround:

1. Register a GitHub App with `Contents: Read & Write` + `Pull requests: Read & Write` + `Workflows: Read & Write`
2. Install it on target repos
3. Store `OPENSPEC_FLOW_APP_ID` and `OPENSPEC_FLOW_PRIVATE_KEY` as repo or org secrets
4. In the workflow, `uses: actions/create-github-app-token@v1` mints a 1-hour installation token
5. Pass that token to `actions/checkout` and `gh` calls

This is the App identity used by both Mode A and Mode B. PATs with `workflow` scope work too but are long-lived credentials and discouraged.

Once that's in place, Mode A can update its own workflow files, which unblocks the iteration pain.

## Rapid dev loop (the actual problem to solve)

The user's pain: edit code → push → wait for Actions → check logs → fix → repeat. Each cycle is minutes. PR comments and issue events make it worse — you wait twice.

```
                       Iteration speed comparison
                       ═══════════════════════════

  Action-only dev:       edit → commit → push → wait 45s ────► see result
                         (~2 min real cycle once you account for retries)

  Probot + smee:         edit → save  ────► tsx restart (1s)
                                       ────► trigger event (gh CLI)
                                       ────► see result in terminal
                         (~5 seconds real cycle)
```

### The fast loop (recommended for development)

Two terminals, one sandbox repo, real GitHub:

```bash
# Terminal 1 — webhook tunnel
npx smee -u https://smee.io/CHANNEL --path /github/webhook --port 3000
# (or ngrok with a static domain for replay UI at localhost:4040)

# Terminal 2 — hot-reload dev server
tsx watch src/index.ts

# Terminal 3 — manufacture events on demand
gh issue create -R me/openspec-flow-sandbox -t "Test" -b "..."
gh issue edit 1  --add-label openspec:go
gh pr comment 2 --body "spec needs multi-line"
```

Each save in `src/` restarts the process in ~1s. Each `gh` command fires a real webhook through smee → your local process. End-to-end visibility, no Action waiting.

For replay without firing fresh events:
- ngrok's `localhost:4040` inspector — one-click replay any past webhook
- GitHub's webhook redelivery API (`POST /app/hook/deliveries/{id}/attempts`) — script with `gh api`
- `probot receive -e issues -p fixtures/issues.labeled.json ./index.ts` — replay a fixture file

For unit tests:
- `nock` + `probot.receive()` with fixtures from `@octokit/webhooks-examples`
- Sub-1-second per test, no network

### Recommended stack (balanced)

| Tool | Purpose |
|---|---|
| ngrok with static free domain | Webhook tunnel + replay inspector |
| `tsx watch` | Sub-second TypeScript restart |
| Probot | Webhook routing + Octokit |
| `@octokit/webhooks-examples` | Realistic fixture payloads |
| Jest + nock | Unit tests without GitHub |
| `gh` CLI smoke-test script | End-to-end via real events |
| Dedicated sandbox repo per dev | Realistic playground |

A second tier:

| Tool | Purpose |
|---|---|
| `nektos/act` | Test the reusable workflow YAML locally (Mode A only) |
| `nock.recorder` | VCR for complex multi-step API flows |
| Cloudflare Tunnel | Persistent URL with no rate limits |
| GitHub Codespaces | Preconfigured dev environment for new contributors |

### What to skip

- `nektos/act` for everything — it simulates the wrong thing for a Probot bot. Use only for testing reusable-workflow logic.
- Polling instead of webhooks. Burns rate limits, hides timing bugs, won't translate to production.
- GraphQL subscriptions. They don't exist on GitHub.

## Workflow-file iteration: how to make it not hurt

The specific friction the user mentioned — "GH workflows themselves updated by GH workflows" — has three answers depending on phase:

1. **Now (Mode A development):** do workflow-YAML iteration in a fork or sandbox repo where you push directly to `main`. Once stable, open a normal PR to the upstream repo. The bot does not edit its own workflow files in the upstream repo; humans do.
2. **Once App is registered (still Mode A):** the workflow uses an App installation token via `actions/create-github-app-token@v1`. That token has `workflows: write` and can open PRs that touch `.github/workflows/`. The bot self-updates its workflow file in the target repo when it needs to.
3. **Mode B (App install):** Probot uses its installation token natively. No `GITHUB_TOKEN` involved. Workflow edits are unblocked from day one.

So: register the App early. Even before Mode B exists, the App's token solves Mode A's biggest constraint.

## Component breakdown (extracted from livedown)

```
openspec-flow/
├── .github/
│   ├── actions/
│   │   ├── openspec-flow-run-agent/        # invokes Claude Code with openspec context
│   │   ├── openspec-flow-preflight/        # validates labels, dedupe, repo state
│   │   ├── openspec-flow-postflight/       # validates artifacts before PR
│   │   ├── openspec-flow-inject-usage-table/  # cost/usage table in PR body
│   │   ├── openspec-flow-flip-label/       # openspec:go → openspec:spec → openspec:impl
│   │   ├── openspec-flow-handle-failure/   # error reporting, label changes
│   │   ├── openspec-flow-prune-comments/   # cleans up stale bot comments
│   │   └── openspec-flow-raise-comment/    # posts/edits the running comment
│   └── workflows/
│       ├── openspec-flow.yml               # reusable workflow consumed by target repos
│       └── ci.yml                          # lint/test for openspec-flow itself
├── src/                                    # Probot app (Phase 2)
│   ├── index.ts
│   ├── handlers/
│   └── core/                               # shared with composite actions
├── tests/
├── openspec/                               # this repo also uses openspec
├── .claude/
├── docs/
│   └── architecture.md                     # this file
├── public/
│   └── index.html                          # landing page
└── package.json
```

## Phases

**Phase 0 — done:** specs and composite actions live in livedown. Use them as the source of truth.

**Phase 1 — extract:**
- Copy the workflow + 8 composite actions out of livedown into this repo.
- Convert the workflow into a `workflow_call` reusable workflow so other repos can `uses:` it.
- Set up tests: `act` for the reusable workflow, Jest for any extracted library code.
- Register the GitHub App `openspec-flow`. Document the install flow.
- Ship as `v0.1.0` and switch livedown to consume `dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v0.1.0`.
- Install on a sandbox repo. Iterate.

**Phase 2 — Probot App:**
- Port the composite-action logic to a TypeScript module callable from either path.
- Stand up Probot on Fly.io.
- Wire smee + ngrok local-dev loop.
- Use App installation tokens; verify `workflows: write` works.
- Marketplace listing.

**Phase 3 — polish:**
- Self-update flow (bot opens PRs against its own workflow file in target repos when versions diverge).
- Cost dashboards (carry forward livedown's usage-table action).
- Multi-tenancy considerations.

## Repository conventions (transferred from livedown)

- TypeScript 5.3, Node 22/24 matrix, CommonJS
- Commander 11 for any CLI
- Jest 30 + ts-jest; `*.test.ts` next to source; `tests/integration/` separate
- ESLint 9 flat config + Prettier (`singleQuote: false`, `trailingComma: "es5"`)
- Husky pre-commit
- `tsc && chmod +x` build, no bundler
- release-please for versioning
- Conventional commits

## Open decisions

- App slug: `openspec-flow` (assumed available; verify).
- Distribution surface: reusable workflow only, or also publish composite actions and an npm scaffolder? Recommend reusable workflow + npm scaffolder (`npx @dwmkerr/openspec-flow init`).
- Whether to keep the workflow inside livedown until v0.1.0 ships, or extract immediately and rewire livedown. Recommend extract first, rewire livedown second.
- Hosting region for Fly.io.

## References

- `scratch/research/framework-choice.md` — full bot framework analysis
- `scratch/research/local-dev-loop.md` — full local dev tooling analysis
- `scratch/research/livedown-patterns.md` — what to carry over
- `references/openspec/` — OpenSpec CLI and skill system reference
- livedown's `openspec/specs/openspec-flow/spec.md` — the authoritative behavioural spec
- [Probot](https://github.com/probot/probot)
- [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action)
- [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token)
- [GitHub Docs — Reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [GitHub Docs — Choosing GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
