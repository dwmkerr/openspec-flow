## Why

The dispatcher in `src/index.ts` routes classified intents to handlers with an if-chain:

```ts
if (intent.kind === "create-spec" || intent.kind === "create-impl" || intent.kind === "iterate-spec") {
  ...
}
```

`src/intent.ts` classifies five intent kinds (`create-spec`, `create-impl`, `iterate-spec`, `iterate-impl`, `noop`). The if-chain silently drops any kind it doesn't list. When PR #52 received `openspec:go` while labelled `openspec:impl`, the classifier correctly emitted `iterate-impl` — but the dispatcher dropped it. The sticky status comment posted "Starting…", then the request returned 200 with no handler invocation. From the reviewer's perspective the bot was hung forever.

This change fixes the gap structurally so it cannot recur.

## What Changes

- **New module `src/handlers/registry.ts`** — a mapped-type `Record<IntentKind, Handler | null>` that requires every kind in the `Intent` discriminated union to be present at compile time.
- **Dispatcher rewrite in `src/index.ts`** — replace the if-chain with a registry lookup. Adding a new intent kind without a registry entry now fails `tsc`.
- **Visible noop for `null` entries** — when a classified intent maps to `null` in the registry, the dispatcher updates the sticky status comment with `❌ <kind> not implemented yet — manage manually` and exits the handler path cleanly. Replaces the silent drop.
- **New handler `src/handlers/iterate-impl/`** — mirrors `iterate-spec` against impl PR branches. Reads PR review comments, top-level comments, inline reviews, and the originating issue; mutates code under `src/`; commits with a message scoped to the iteration. The harness pushes.
- **CLI plumbing** — `src/cli.ts` learns `handle iterate-impl --pr <impl-pr> --repo <owner/repo>` so the Action shim can drive the handler in the same shape as the others.

## Capabilities

### New Capabilities

- `dispatcher-handler-registry`: defines the registry contract — exhaustiveness, dispatch shape, visible-noop semantics for unhandled intents, error surfaces. Owns the routing layer, not the individual handler behaviour.
- `iterate-impl-handler`: defines the iterate-impl behavioural contract — feedback surfaces read, scope of allowed mutations, branch + commit shape, sticky status updates.

### Modified Capabilities

None. The classifier (`intent-recognition`) already emits all five kinds correctly. The canonical `openspec-flow` spec does not currently describe dispatcher routing, so there is nothing to modify — the new `dispatcher-handler-registry` capability fills the gap.

## Impact

- **Affected code**:
  - new `src/handlers/registry.ts`
  - new `src/handlers/iterate-impl/{index.ts, prompt.md, verify.ts, index.test.ts}`
  - modified `src/index.ts` — dispatcher body replaced
  - modified `src/cli.ts` — add `handle iterate-impl` subcommand
- **Affected tests**: new unit tests for the registry exhaustiveness shape (compile-time check via `tsd`-style trick or runtime assertion), unit tests for iterate-impl handler covering the happy path + the failure surface.
- **APIs**: no external API change. Webhook permissions unchanged.
- **Infrastructure**: none.
- **Dependencies**: none.

This change does not modify the public label contract or the OpenSpec change-lifecycle surfaces; iterate-impl just shows up where it should always have.
