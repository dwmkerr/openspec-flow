<p align="center">
  <h2 align="center"><code>📐 openspec-flow</code></h2>
  <h3 align="center">Drive OpenSpec spec-driven development from GitHub issues.</h3>
  <p align="center">
    Label an issue. Get a spec PR. Merge it. Get an implementation PR.
  </p>
</p>

## How it works

```
   Open issue                  Iterate on spec              Review implementation
   add openspec:go     ────►   Discuss in the PR.    ────►  Discuss. Use openspec:go
                                Use openspec:go to update.   to update.

   [issue #42]                 [PR #43 openspec:spec]       [PR #44 openspec:impl]
```

Three labels drive the whole flow:

| Label | Meaning |
|---|---|
| `openspec:go` | Trigger. Apply to an issue to start the flow. Comment with this on a PR to re-run iteration. |
| `openspec:spec` | The spec PR. Review the proposal + spec. Merge when good. |
| `openspec:impl` | The implementation PR. Code that matches the merged spec. Merge to ship. |

Discussion is optional. Comment on a PR with feedback and the agent updates the spec or implementation in place.

See the [mental model page](./public/index.html) for the full one-page picture.

## Install

Two install modes. Pick one.

### Mode A — drop in a workflow file (simplest)

In your repo, add `.github/workflows/openspec-flow.yml`:

```yaml
name: openspec-flow
on:
  issues:            { types: [labeled] }
  issue_comment:     { types: [created] }
  pull_request_review_comment: { types: [created] }

jobs:
  flow:
    uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1
    secrets:
      ANTHROPIC_API_KEY:          ${{ secrets.ANTHROPIC_API_KEY }}
      OPENSPEC_FLOW_APP_ID:       ${{ secrets.OPENSPEC_FLOW_APP_ID }}
      OPENSPEC_FLOW_PRIVATE_KEY:  ${{ secrets.OPENSPEC_FLOW_PRIVATE_KEY }}
```

Add three secrets (`ANTHROPIC_API_KEY`, `OPENSPEC_FLOW_APP_ID`, `OPENSPEC_FLOW_PRIVATE_KEY`).
Add the three labels (`openspec:go`, `openspec:spec`, `openspec:impl`).
Open an issue. Apply `openspec:go`. Done.

### Mode B — install the GitHub App (coming soon)

One-click org-wide install. No workflow file needed. See `docs/architecture.md`.

## Use it

1. Open an issue. Describe a feature, bug, or task.
2. Apply the `openspec:go` label.
3. The agent opens a **spec PR** (`openspec:spec`). Review it. Comment if changes needed. Merge.
4. The agent opens an **implementation PR** (`openspec:impl`) that matches the merged spec. Review it. Merge to ship.

That's the whole interface.

## What's inside

- Built on [OpenSpec](https://github.com/Fission-AI/OpenSpec) — the spec-driven development framework.
- Powered by Claude Code 2.0 via `anthropics/claude-code-action`.
- Composite actions for orchestration, lifted from the original implementation in [livedown](https://github.com/dwmkerr/livedown).

See [`docs/architecture.md`](./docs/architecture.md) for the full picture.

## Develop

See [`docs/developer-guide.md`](./docs/developer-guide.md). The short version:

```bash
npm install
cp .env.example .env  # fill in App credentials + Anthropic key
npm run dev:tunnel    # terminal 1
npm run dev           # terminal 2

# trigger work from terminal 3
./scripts/smoke/label-issue.sh
```

Sub-5-second iteration once set up.

## Status

Phase 1 — extracting from livedown. Phase 2 — Probot App. See [`docs/architecture.md`](./docs/architecture.md) for the roadmap.

## License

MIT.
