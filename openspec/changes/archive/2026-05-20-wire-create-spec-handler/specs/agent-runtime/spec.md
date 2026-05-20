# agent-runtime Specification

## ADDED Requirements

### Requirement: Runtime SHALL NOT impose a reply-parsing convention on handlers

The runtime SHALL NOT impose any parsing convention on the string returned by `runAgent`; handlers MAY ignore the reply entirely and inspect the workdir filesystem to determine what the agent did.

#### Scenario: Handler reads filesystem instead of reply
- **GIVEN** the create-spec handler invokes the agent in a cloned
  workdir
- **WHEN** the agent returns
- **THEN** the handler lists `workdir/openspec/changes/` to find
  the agent's output rather than parsing the returned string

### Requirement: All Claude tools are allowed inside agent invocations by default

The runtime SHALL permit Read, Write, Edit, Bash, Glob, Grep, and
all other built-in Claude tools inside agent invocations unless a
handler explicitly narrows the allowlist via `opts.options.allowedTools`.
Restricting agent capabilities is the handler's concern, not the
runtime's.

#### Scenario: Default invocation has no tool restriction
- **WHEN** `runAgent({ prompt, cwd, log })` is called without
  `options.allowedTools`
- **THEN** the SDK is invoked with no `allowedTools` parameter and
  the agent has access to every built-in tool
