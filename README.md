<p align="center">
  <h2 align="center"><code>📐 openspec-flow</code></h2>
  <h3 align="center">Drive OpenSpec spec-driven development from GitHub issues.</h3>
  <p align="center">
    Label an issue. Get a spec PR. Merge it. Get an implementation PR.
  </p>
</p>

## How it works

1. **Label an issue** with `openspec:go`.
2. **A specification PR opens automatically.** Review it, comment, or push back. Re-apply `openspec:go` on the PR to update the spec based on the discussion. Merge when you're happy with it.
3. **An implementation PR is raised**, which archives the change. Re-apply `openspec:go` on this PR after comments or discussion to improve the implementation.
4. **Merge the implementation PR.** The original issue closes automatically.

See [`docs/how-it-works.md`](./docs/how-it-works.md) for the richer version with screenshots of every state.

## Install

### Install the GitHub App (recommended)

[**openspec-flow on the GitHub Apps marketplace**](https://github.com/apps/openspec-flow)

Install on a repository. A pull request opens automatically containing the workflow shim that drives the flow, along with instructions for setting the required secrets. Merge it and the flow is live.

### Shim it yourself (when you can't install the App)

If you can't install the App, install the CLI and let it scaffold the same machinery as a pull request:

```bash
npx @dwmkerr/openspec-flow install
```

The CLI explains how to create the three contract labels (`openspec:go`, `openspec:spec`, `openspec:impl`) and how to set the required Anthropic API key secret. Same workflow, same flow.

**App vs shim trade-off**: with the App, status comments update in **real time** as you work. With the shim, status updates happen during the workflow run, so feedback lags by ~30 seconds while the runner spins up. Both modes operate identically beyond that.

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
