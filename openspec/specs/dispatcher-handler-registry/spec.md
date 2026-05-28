# dispatcher-handler-registry Specification

## Purpose
TBD - created by archiving change dispatcher-handler-registry. Update Purpose after archive.
## Requirements
### Requirement: Exhaustive handler registry

The dispatcher SHALL route classified intents through a registry typed as `{ [K in IntentKind]: Handler<K> | null }`, where `IntentKind` is the discriminated `kind` field of the `Intent` union exported from `src/intent.ts`. Adding a new variant to `Intent` without a corresponding registry entry SHALL cause a TypeScript compilation error.

#### Scenario: All intent kinds appear in the registry

- **WHEN** the project builds via `tsc`
- **THEN** the build succeeds only if every kind in `Intent["kind"]` has an entry in `HANDLERS`
- **AND** every entry is either a function matching `Handler<K>` or the literal `null`

#### Scenario: Compile fails on missing entry

- **WHEN** a developer adds a new variant `{ kind: "archive-impl"; ... }` to `Intent` without touching the registry
- **THEN** `npm run typecheck` exits non-zero with a `TS2741` (property missing) diagnostic naming `archive-impl`

### Requirement: Dispatch by registry lookup

The dispatcher in `src/index.ts` SHALL look up the handler for a classified intent by `intent.kind` and invoke it with the standard handler context (`owner`, `repo`, `octokit`, `gitPushToken`, `log`, `statusCommentId`, `statusTargetNumber`). The dispatcher SHALL NOT branch on `intent.kind` outside the registry lookup.

#### Scenario: Routed intent invokes handler

- **WHEN** the dispatcher receives an intent whose registry entry is a function
- **THEN** the handler is invoked exactly once with the standard handler context
- **AND** the handler's promise resolution determines the dispatcher's return path

#### Scenario: Dispatcher contains no per-intent if-chain

- **WHEN** the source of `src/index.ts` is read
- **THEN** there is no expression of the form `intent.kind === "<kind>" || intent.kind === "<other-kind>"` outside the registry module

### Requirement: Visible noop for unhandled intents

When a classified intent's registry entry is `null`, the dispatcher SHALL update the sticky status comment with a terminal failure line of the form `❌ \`<kind>\` is classified but not implemented yet — manage manually.` and SHALL log a structured warning carrying the intent kind and webhook delivery id. The dispatcher SHALL NOT throw or retry.

#### Scenario: Null handler surfaces terminal state on the sticky comment

- **WHEN** the dispatcher routes an intent whose registry entry is `null`
- **AND** a sticky status comment was created for the run
- **THEN** the sticky comment body is updated to include the failure line naming the kind
- **AND** the dispatcher returns without throwing

#### Scenario: Null handler logs a structured warning

- **WHEN** the dispatcher routes an intent whose registry entry is `null`
- **THEN** the application log contains a single record at `warn` level with fields `{ kind, deliveryId }` matching the routing context

### Requirement: Handler context

The registry SHALL accept handlers whose call signature is `(intent, ctx) => Promise<unknown>` where `ctx` matches the existing `HandlerCtx` shape used by `handleCreateSpec`, `handleCreateImpl`, and `handleIterateSpec`. The dispatcher SHALL pass a freshly-minted installation token in `ctx.gitPushToken`.

#### Scenario: Token freshness

- **WHEN** the dispatcher routes any non-null intent
- **THEN** `ctx.gitPushToken` carries a token obtained from `context.octokit.auth({ type: "installation" })` within the same request

#### Scenario: Status comment id propagation

- **WHEN** the dispatcher routes any non-null intent and a sticky status comment was created
- **THEN** `ctx.statusCommentId` is the integer id of that comment
- **AND** `ctx.statusTargetNumber` is the issue or PR number on which the comment lives

