# Developer Guide

How to develop `openspec-flow` with a fast feedback loop. Designed for a two-terminal workflow against a real GitHub repo.

## TL;DR

```bash
# one-time setup
npm install
cp .env.example .env  # fill in APP_ID, PRIVATE_KEY, WEBHOOK_SECRET, ANTHROPIC_API_KEY

# every day
npm run dev:tunnel    # terminal 1 — webhook tunnel
npm run dev           # terminal 2 — Probot, auto-reload on save

# trigger work from a third terminal
gh issue create -t "test feature" -b "..."
gh issue edit 1 --add-label openspec:go
```

Each edit to `src/` restarts the bot in ~1s. Each `gh` command fires a real webhook through the tunnel and runs the local handler. Cycle time: 5 seconds.

## What lives where

```
openspec-flow/
├── .github/
│   ├── actions/openspec-flow-*/   # 8 composite actions lifted from livedown
│   └── workflows/openspec-flow.yml # reusable workflow + direct-install hybrid
├── src/                           # Probot app (Phase 2 / dev loop)
│   ├── index.ts                   # entry point
│   └── handlers/                  # event handlers
├── openspec/specs/                # the spec(s) for openspec-flow itself
├── docs/                          # this file, architecture.md
├── public/index.html              # landing page (the mental model triptych)
├── scratch/                       # ephemeral research, lift notes, mockups
└── package.json
```

## Two install modes, two test paths

This repo ships in two modes (see `docs/architecture.md`). They have different dev loops.

| Mode | What's tested | How to test |
|---|---|---|
| **Mode A — Action** (the reusable workflow) | `.github/workflows/openspec-flow.yml` + composite actions running on a GitHub Actions runner | Push to a sandbox repo, label an issue, watch the Actions tab. Or `act` for offline iteration of the YAML. |
| **Mode B — Probot App** (the long-lived service) | `src/` — TypeScript code reacting to webhooks | The fast two-terminal loop below. |

You'll spend most time in Mode B's loop because it's seconds, not minutes. Mode A is exercised by CI and the occasional manual run on the sandbox repo.

## Mode B: the fast loop

### Prerequisites

- Node 22 or 24
- `gh` CLI authenticated to your GitHub account
- A registered GitHub App named `openspec-flow-dev` (see "Register a dev App" below)
- A sandbox repo where the App is installed — for now use this repo (`dwmkerr/openspec-flow`)
- ngrok or smee for webhook tunneling

### Register a dev App

See [`docs/app-setup.md`](./app-setup.md). One-time, ~5 minutes. End state: `private-key.pem` at repo root and a filled `.env`.

### Webhook tunnel — pick one

**ngrok (recommended)** — has a free static domain and a replay inspector at `localhost:4040`:

```bash
# one-time
ngrok config add-authtoken <token>           # free signup at ngrok.com
ngrok config edit                            # add: agent: { ... domains: ["yourname-openspec.ngrok-free.app"] }

# every day (terminal 1)
ngrok http 3000
```

In the App settings page, set Webhook URL to `https://yourname-openspec.ngrok-free.app/api/github/webhooks`. One-time. The static domain means you never update this.

**smee.io (simpler, less powerful)** — no replay UI:

```bash
# one-time
visit https://smee.io/new, copy the URL

# every day (terminal 1)
npx smee -u https://smee.io/CHANNEL --path /api/github/webhooks --port 3000
```

In the App settings page, set Webhook URL to the smee URL.

### Dev server (terminal 2)

```bash
npm run dev
```

This runs `tsx watch src/index.ts`. Edit any file under `src/`, save, and the process restarts in ~1s with the new code. Probot logs every received webhook to stdout.

#### Dispatch mode

The Probot adapter only dispatches issue/PR events in-proc when `OPENSPEC_FLOW_DISPATCH_MODE=in-process`. Without it, those handlers no-op so the shim workflow in the user's repo is the sole dispatcher — that's the production posture. Local dev that wants to step through `runDispatch` needs the flag set:

```bash
OPENSPEC_FLOW_DISPATCH_MODE=in-process npm run dev
```

Probot prints `dispatch-mode=<value>` on boot. The `installation.created` handler ignores the flag — it always runs, because only Probot ever sees install events.

#### Driving the App's init PR locally

Two ways to exercise the init-PR path without installing the App on a real repo:

```bash
# open the PR via gh's token (default)
npx tsx src/cli.ts app-init --repo <owner/sandbox>

# preview the plan against any remote repo (no writes)
npx tsx src/cli.ts app-init --repo <owner/sandbox> --dry-run
```

Same `runAppInit` core the `installation.created` handler calls, so behaviour matches one-for-one.

**Token scopes**: the init commit writes `.github/workflows/openspec-flow.yml`, which GitHub gates behind the `workflow` scope (separate from `repo`). If `gh auth status` shows scopes without `workflow`, the tree-write returns 404 with `Not Found - .../create-a-tree`. Fix once:

```bash
gh auth refresh -s workflow
```

The App-mode equivalent is `Workflows: Read & write` in the App's permission manifest — see `docs/app-setup.md`.

### Manufacture events (terminal 3)

The fastest way to trigger work without clicking around in GitHub:

```bash
# create an issue
gh issue create -t "Add CSV export for orders" \
                -b "Users want CSV download. RFC 4180 formatting."

# apply the trigger label
gh issue edit 1 --add-label openspec:go

# comment on a PR (to drive the iteration loop)
gh pr comment 2 --body "spec is close — handle multi-line"

# manually redeliver the last webhook (if your handler crashed mid-run)
gh api -X POST /app/hook/deliveries/<delivery-id>/attempts
```

Wrap these into `scripts/smoke/*.sh` once the patterns stabilise.

### Replaying webhooks

When iterating on a single handler:

- **ngrok inspector** (`localhost:4040` in browser): every received webhook is visible; click any one and hit `Replay`. Lets you edit the body before replay.
- **Probot's built-in fixture replay:** `npx probot receive -e issues -p fixtures/issues.labeled.json ./src/index.ts`. Use this for unit-style runs with captured fixtures.
- **GitHub redelivery API:** `gh api -X POST /app/hook/deliveries/{id}/attempts` — re-delivers a real past event. 3-day window.

Save useful payloads as fixtures the first time you see them:

```bash
mkdir -p tests/fixtures
gh api /app/hook/deliveries/<id> > tests/fixtures/issues.labeled.openspec-go.json
```

### Unit tests (no GitHub at all)

```bash
npm test
```

Uses Jest + nock + `@octokit/webhooks-examples` for fixtures. Each test calls `probot.receive(...)` with a fixture and asserts on the Octokit calls made. Sub-second per test. Run constantly with `npm run test:watch`.

## Mode A: testing the reusable workflow

The workflow at `.github/workflows/openspec-flow.yml` is the thing target repos install. Two ways to exercise it:

**Real-world test** (recommended) — push this repo to GitHub, label an issue, watch the Actions tab. Slow (~60s per cycle) but covers the real environment.

**Offline test with `act`:**

```bash
brew install act
act issues -e tests/fixtures/issues.labeled.openspec-go.json \
           --secret-file .env.act \
           -W .github/workflows/openspec-flow.yml
```

Notes:
- `act` doesn't simulate `${{ github.token }}` perfectly. Some steps will fail or need stubbing.
- Composite actions referenced as `./.github/actions/openspec-flow-*` resolve locally — easy.
- Use this for "did the YAML logic break" not "does the full flow work end-to-end".

## Inspecting PR metadata

The bot maintains a hidden HTML-comment block at the bottom of every PR body
carrying linkage data (issue number, change name, kind, sibling PR).

```html
<!-- openspec-flow:auto-maintained — do not remove or edit
issue: 42
kind: spec
change: add-csv-export
-->
```

It's invisible in GitHub's rendered view. To inspect:

```bash
gh pr view <n> --json body -q .body
```

Or on the PR page, press `e` (edit description) to see the raw source. The
block is the canonical link between issue, spec PR, and impl PR. See
`CLAUDE.md` for the schema.

## The workflow-write permission problem

If a workflow run needs to modify `.github/workflows/*.yml` (e.g., self-update the openspec-flow.yml in a target repo), the default `GITHUB_TOKEN` will refuse — it doesn't carry `workflows: write` and you can't grant it via `permissions:`.

Workaround used here:

```yaml
# inside the workflow
- uses: actions/create-github-app-token@v1
  id: app-token
  with:
    app-id: ${{ secrets.OPENSPEC_FLOW_APP_ID }}
    private-key: ${{ secrets.OPENSPEC_FLOW_PRIVATE_KEY }}

- uses: actions/checkout@v4
  with: { token: ${{ steps.app-token.outputs.token }} }
```

Use the App token, not `secrets.GITHUB_TOKEN`, anywhere you need workflow-write. The App must have `Workflows: Read & Write` granted at registration time.

## Where to test issues right now

Use **this repo** (`dwmkerr/openspec-flow` once it's pushed) as the sandbox. Reasons:

- Already has the dev App installed
- Mistakes are recoverable (just close issues / delete PRs)
- Issues here naturally become real openspec-flow features over time

Once that stabilises, spin up a dedicated sandbox repo per developer.

## Naming collision to resolve later

`.github/workflows/openspec-flow.yml` here is BOTH:
- The workflow this repo dogfoods (CI for openspec-flow itself)
- The reusable workflow target repos `uses:` to install

We made it dual-mode (has `workflow_call:` + `issues:` triggers). If this is confusing, options:

- Keep dual-mode (current state)
- Split into `openspec-flow-reusable.yml` (target install) + `openspec-flow.yml` (this repo's dogfood)
- Move the reusable one to `.github/workflows/template/openspec-flow.yml` and document the `uses:` path

Decision deferred. Right now it works for both.

## Useful commands

```bash
npm run dev               # start Probot with auto-reload
npm run dev:tunnel        # start ngrok (or smee) tunnel
npm test                  # Jest unit tests
npm run test:watch        # Jest in watch mode
npm run lint
npm run lint:fix
npm run build             # tsc to dist/
npm run typecheck         # tsc --noEmit, no output

# event manufacturing
gh issue create -t "..." -b "..."
gh issue edit N --add-label openspec:go
gh issue edit N --remove-label openspec:go
gh pr comment N --body "..."
gh api /app/hook/deliveries                       # list recent deliveries
gh api -X POST /app/hook/deliveries/<id>/attempts # redeliver

# workflow testing
act issues -e tests/fixtures/issues.labeled.openspec-go.json -W .github/workflows/openspec-flow.yml
```

## Common failure modes

- **Webhook not arriving** — check tunnel is up. Open ngrok's `localhost:4040` to see incoming requests. Verify Webhook URL in App settings matches the tunnel URL.
- **Signature verification failed** — `WEBHOOK_SECRET` mismatch between `.env` and App settings.
- **403 on PR create** — App not installed on target repo, or missing `Pull requests: Write` permission.
- **403 on workflow file update** — using `GITHUB_TOKEN` instead of an App-minted token. See above.
- **Composite action not found** — `act` couldn't resolve `./.github/actions/...`. Run from repo root, not `act` subdir.
- **Probot complains about no listener for event** — handler not registered in `src/index.ts`. Add the `app.on(...)` line.

## Glossary

- **Mode A** — the install-a-workflow-file path. Target repos copy a shim into `.github/workflows/`.
- **Mode B** — the GitHub App path. Org installs one App; everything else is server-side.
- **Reusable workflow** — a workflow that other workflows can call via `uses: owner/repo/.github/workflows/foo.yml@ref`.
- **Composite action** — a multi-step action defined in `action.yml` under `.github/actions/`. Lifted 8 of these from livedown.
- **Probot** — Node.js framework that wraps Octokit + webhook routing.
- **smee** — webhook tunnel maintained by Probot. Free, basic.
- **ngrok** — webhook tunnel with a paid tier and an excellent replay inspector. Free tier now includes static domains.
- **`openspec:go`** — the trigger label users add to an issue to invoke the bot.
- **`openspec:spec`** — label on the spec PR.
- **`openspec:impl`** — label on the implementation PR.

## Sources for the patterns above

- `docs/architecture.md` — the why
- `scratch/research/local-dev-loop.md` — exhaustive tool-by-tool comparison
- `scratch/research/framework-choice.md` — bot framework deep dive
- `scratch/research/livedown-lift-report.md` — what was copied from livedown
- `scratch/research/livedown-patterns.md` — what to adopt vs skip
