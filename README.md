<p align="center">
  <h2 align="center"><code>📐 openspec-flow</code></h2>
  <h3 align="center">Drive OpenSpec spec-driven development from GitHub issues.</h3>
  <p align="center">
    Label an issue. Get a spec PR. Merge it. Get an implementation PR.
  </p>
</p>

## How it works

```
   Open issue                  Iterate on spec               Review implementation
   add openspec:go     ────►   Spec PR created with    ────► Impl PR created with
                                openspec:spec label.          openspec:impl label.
                                Use openspec:go to update.    Use openspec:go to update.
                                Merge when ready.             Merge to ship.

   [issue #42]                 [PR #43 openspec:spec]        [PR #44 openspec:impl]
```

You apply one label. The bot applies the rest.

| Label | Applied by | Meaning |
|---|---|---|
| `openspec:go` | **you** | Trigger. Add to an issue to start; add to a PR to re-run iteration. |
| `openspec:spec` | bot | Spec PR — review the proposal, then merge. |
| `openspec:impl` | bot | Implementation PR — review the code, then merge to ship. |

Discussion is optional. Comment, re-apply `openspec:go`, the agent updates in place.

## Install

### Mode A — install the GitHub App (recommended)

```
https://github.com/apps/openspec-flow-dev/installations/new
```

Pick the repo. The App opens a setup PR (branch `chore/openspec-flow-init`) that scaffolds the shim workflow + README block + creates the three contract labels. Set `ANTHROPIC_API_KEY` (`gh secret set ANTHROPIC_API_KEY -R <owner/repo>`) and merge.

### Mode B — drop in a workflow file

In your repo, add `.github/workflows/openspec-flow.yml`:

```yaml
name: openspec-flow
on:
  issues:            { types: [labeled] }
  pull_request:      { types: [labeled, closed] }
  issue_comment:     { types: [created] }
  pull_request_review_comment: { types: [created] }
permissions:
  contents: write
  issues: write
  pull-requests: write
jobs:
  flow:
    uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@main
    secrets:
      ANTHROPIC_API_KEY:          ${{ secrets.ANTHROPIC_API_KEY }}
      OPENSPEC_FLOW_APP_ID:       ${{ secrets.OPENSPEC_FLOW_APP_ID || '' }}
      OPENSPEC_FLOW_PRIVATE_KEY:  ${{ secrets.OPENSPEC_FLOW_PRIVATE_KEY || '' }}
```

Add `ANTHROPIC_API_KEY` to repo secrets. Create the three contract labels. Or just run `npx @dwmkerr/openspec-flow install` to do all of that.

## Use

1. Open an issue describing the work.
2. Apply `openspec:go`.
3. Review the spec PR. Merge.
4. Review the impl PR. Merge to ship.

That's the whole interface.

## Develop

See [`docs/developer-guide.md`](./docs/developer-guide.md). Built on [OpenSpec](https://github.com/Fission-AI/OpenSpec) + Claude Agent SDK. Architecture in [`docs/architecture.md`](./docs/architecture.md).

```bash
npm install
cp .env.example .env
npm run dev:tunnel    # terminal 1
npm run dev           # terminal 2
```

## License

MIT.
