# State machine

Authoritative model of how a piece of work moves through openspec-flow, and
where each surface (label, comment, reaction, breadcrumb) gets written.

**Treat this page as the contract.** If code or another doc disagrees, this is
the source of truth — fix the code or doc.

## Lifecycle states

```
       ┌──────────┐
       │  open    │  user opens an issue
       │  issue   │
       └────┬─────┘
            │ user adds openspec:go
            ▼
       ┌──────────┐        ┌─────────────────┐
       │ spec PR  │ ◄────► │ spec PR         │  user re-applies
       │ open     │        │ iterating       │  openspec:go on PR
       └────┬─────┘        └─────────────────┘
            │ user merges spec PR (pull_request.closed merged + openspec:spec)
            ▼
       ┌──────────┐        ┌─────────────────┐
       │ impl PR  │ ◄────► │ impl PR         │  user re-applies
       │ open     │        │ iterating       │  openspec:go on PR
       └────┬─────┘        └─────────────────┘
            │ user merges impl PR (pull_request.closed merged + openspec:impl)
            ▼
       ┌──────────┐
       │ closed   │  issue auto-closed via Closes #N in impl PR body
       │ issue    │
       └──────────┘
```

## Trigger → intent (the classifier)

| Event                                        | Target state                    | Intent          |
|----------------------------------------------|---------------------------------|-----------------|
| `issues.labeled` + `openspec:go`             | open issue, no linked spec PR   | `create-spec`   |
| `pull_request.labeled` + `openspec:go`       | open PR with `openspec:spec`    | `iterate-spec`  |
| `pull_request.labeled` + `openspec:go`       | open PR with `openspec:impl`    | `iterate-impl`  |
| `pull_request.closed` + `merged:true`        | PR with `openspec:spec`         | `create-impl`   |
| `pull_request.closed` + `merged:true`        | PR with `openspec:impl`         | `finalize-impl` |
| anything else                                | —                               | `noop`          |

The trigger is **always** `openspec:go` (or a merge). The classifier never
scans free-form text.

## Surfaces (where things get written)

Every intent writes a consistent set of surfaces. The table below is the
contract — if you add a new surface, add a row.

| Surface              | When written                                  | Where it lives                                | Lifecycle          |
|----------------------|-----------------------------------------------|-----------------------------------------------|--------------------|
| 👀 reaction          | on actionable intent                          | target issue/PR                               | added at start, removed at end of run |
| Sticky status comment | on actionable intent                          | target issue/PR (= issue for create-spec, spec PR for create-impl, PR for iterate-*) | one per intent, mutated through the run |
| Run-link line in sticky body | every state mutation of the sticky      | inside the sticky's body                      | always present when in Action-mode runner; omitted in Probot in-proc |
| Issue lifecycle breadcrumb | once per terminal state                  | originating issue                             | grows through the flow: `spec PR opened: #M` → `impl PR opened: #N` → `done` |
| Issue early breadcrumb (NEW) | on `create-impl` start, before handler  | originating issue                             | upserted once per impl run, carries run link |
| Spec PR body metadata | when the agent opens the spec PR             | spec PR body (HTML comment)                   | static |
| Impl PR body metadata | when the agent opens the impl PR             | impl PR body (HTML comment)                   | static |

## Who writes what (App vs Workflow)

Production posture is `OPENSPEC_FLOW_DISPATCH_MODE=action` (default): App
handles install events + acknowledgement-only side effects; Workflow does all
dispatch work via the shim.

| Surface                       | App (action mode)                  | Workflow                                | Idempotency mechanism                    |
|-------------------------------|------------------------------------|-----------------------------------------|------------------------------------------|
| 👀 reaction add               | pre-gate, ~1s                      | `runDispatch` entry                     | `reactions.createForIssue` 200 on dup    |
| 👀 reaction remove            | on `workflow_run.completed`        | `runDispatch` finally                   | `reactions.listForIssue` + delete; 404 swallowed |
| Sticky status comment         | n/a (gate blocks `runDispatch`)    | created + mutated through run           | list comments → find by marker → PATCH or POST |
| Run-link in sticky body       | n/a (App has no run id)            | reads `GITHUB_RUN_ID` env, renders link | body fully re-rendered each state change |
| Issue lifecycle breadcrumb    | on `pull_request.closed` (merged)  | `runDispatch` terminal renderer         | same marker upsert as sticky             |
| Issue early breadcrumb (NEW)  | pre-gate on `pull_request.closed` merged + `openspec:spec`, posts "impl run starting…" | `create-impl` handler entry, upserts with run link + state | marker `<!-- openspec-flow:issue-breadcrumb intent=create-impl issue=N spec-pr=M -->` |

**Rule of dual-write**: any surface that *could* be written by both must use a
marker comment + list-then-edit-or-create. Reaction add/remove are
GitHub-API-idempotent so they don't need markers; everything else needs one.

## Reaction lifecycle

```
   openspec:go applied
            │
            ▼
   ┌────────────────────────┐
   │ App: addEyes pre-gate  │  ~1s
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │ Workflow: addEyes      │  ~30s (in action mode)
   │ at runDispatch entry   │  (idempotent — same content, same author)
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │ Handler runs           │
   │ Sticky comment mutates │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │ Workflow: removeEyes   │  end of run (success OR failure)
   │ in runDispatch finally │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │ App: removeEyes        │  on workflow_run.completed
   │ (backstop)             │  (idempotent — 404 swallowed)
   └────────────────────────┘
```

## See also

- `CLAUDE.md` § "The flow" — the high-level UX.
- `openspec/specs/openspec-flow/spec.md` — the formal requirement-level spec.
- `openspec/specs/intent-recognition/spec.md` — the classifier's contract.
- `src/intent.ts` — the implementation of the classifier.
- `src/dispatch.ts` — the actionable-intent sequence.
- `src/index.ts` — the Probot adapter (pre-gate side effects).
