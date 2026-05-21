## ADDED Requirements

### Requirement: Agent SHALL emit an iteration-replies JSON file before committing

The agent's prompt SHALL instruct it to write `.openspec-flow/iteration-replies.json` in the workdir before its final commit, recording (a) inline-comment replies it intends to post, (b) review-thread node IDs it intends to resolve, and (c) a per-reviewer changelog. The schema SHALL be:

```jsonc
{
  "replies":          [{ "commentId": <number>, "kind": "done"|"addressed"|"wontfix", "body": <string> }, ...],
  "resolveThreadIds": [<string>, ...],
  "changelog":        [{ "user": <string>, "request": <string>, "action": <string> }, ...]
}
```

The agent SHALL substitute the literal token `<sha>` in any reply body it expects to reference the iteration's commit — the handler resolves the token after committing. The agent SHALL ignore comments authored by `openspec-flow[bot]` (including the bot's prior inline replies) when deciding which `commentId`s to include.

#### Scenario: Agent writes the JSON file with three replies and a changelog
- **WHEN** the agent finishes editing artefacts and runs its final commit
- **THEN** `.openspec-flow/iteration-replies.json` exists in the workdir with a valid `replies` array, optional `resolveThreadIds` array, and `changelog` array matching the schema above

#### Scenario: Agent uses the <sha> token for commit references
- **GIVEN** the agent intends a reply body `Done in <sha>.`
- **WHEN** it writes the JSON file
- **THEN** the literal string `<sha>` appears in the body and the handler replaces it after `git commit`

### Requirement: Handler SHALL post one inline reply per entry in `replies` after a successful push

After pushing the iterated branch, the handler SHALL read `.openspec-flow/iteration-replies.json`, substitute the short commit SHA from `git rev-parse --short HEAD` for any `<sha>` token in each reply body, and POST each reply via `octokit.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies", ...)`. The handler SHALL post replies sequentially in array order.

#### Scenario: Three replies posted with SHA substituted
- **GIVEN** the JSON file lists three entries with comment IDs 11, 12, 13 and the first body is `Done in <sha>.`
- **WHEN** the handler runs after `git commit` produced short SHA `abc1234`
- **THEN** three POSTs to `/pulls/<pr>/comments/<id>/replies` occur and the first body is `Done in abc1234.`

### Requirement: Handler SHALL resolve every thread listed in `resolveThreadIds` via GraphQL

For each `threadId` in `resolveThreadIds`, the handler SHALL execute the GraphQL mutation `resolveReviewThread(input: { threadId })` via `octokit.graphql()`. The handler SHALL execute resolutions sequentially after the inline replies have been posted.

#### Scenario: Two threads resolved
- **GIVEN** `resolveThreadIds` lists two node IDs
- **WHEN** the handler runs after posting inline replies
- **THEN** `octokit.graphql` is called twice with the `resolveReviewThread` mutation, one threadId each

### Requirement: Handler SHALL append the rendered changelog to the terminal status comment

When the JSON file contains a non-empty `changelog` array, the handler SHALL render it as a Markdown bullet list of the form `- @<user>: <request> → <action>` and pass the rendered block to `statusSpecUpdated()` so the terminal status body becomes the existing success line followed by a blank line, a bold `**This iteration**` heading, then the bullets. When `changelog` is empty or absent the terminal body SHALL be the existing success line unchanged.

#### Scenario: Changelog appended on success
- **GIVEN** `changelog` lists `{user: alice, request: "multi-line handling", action: "proposal §3, tasks 4.2"}` and `{user: bob, request: "tighten failure contract", action: "design.md error table"}`
- **WHEN** the handler updates the terminal status comment
- **THEN** the comment body equals `✅ spec updated by openspec-flow\n\n**This iteration**\n- @alice: multi-line handling → proposal §3, tasks 4.2\n- @bob: tighten failure contract → design.md error table`

#### Scenario: Empty changelog keeps the existing terminal body
- **GIVEN** the JSON file has `changelog: []`
- **WHEN** the handler updates the terminal status comment
- **THEN** the body equals the existing `✅ spec updated by openspec-flow` and nothing else

### Requirement: Reply, resolve, and changelog steps SHALL be best-effort and isolated per call

Each inline-reply POST, each `resolveReviewThread` mutation, and JSON-parse SHALL be wrapped in its own try/catch. A failure SHALL be warn-logged with the operation name and error message and SHALL NOT (a) skip remaining replies / resolves, (b) prevent the terminal status update, or (c) re-throw. A `ENOENT` on the JSON file SHALL be logged at info level (not warn) and SHALL skip all three steps cleanly.

#### Scenario: Missing JSON file is a clean skip
- **GIVEN** the agent did not create `.openspec-flow/iteration-replies.json`
- **WHEN** the handler reaches the reply/resolve/changelog step
- **THEN** the handler logs `iterate-spec: no iteration-replies.json — skipping replies/resolve/changelog` at info, posts no inline replies, runs no GraphQL mutations, and the terminal status body is the existing `✅ spec updated by openspec-flow`

#### Scenario: Malformed JSON does not block the terminal status update
- **GIVEN** the JSON file exists but cannot be parsed
- **WHEN** the handler reaches the reply step
- **THEN** the handler warn-logs the parse error, posts no replies, runs no mutations, and still updates the status comment to `✅ spec updated by openspec-flow` (without changelog)

#### Scenario: One reply 404s, the others still post
- **GIVEN** three replies are queued and the second comment ID was deleted
- **WHEN** the handler POSTs each reply
- **THEN** the second POST raises and is warn-logged, the first and third still post, and the handler proceeds to thread resolution

#### Scenario: GraphQL resolve failure does not block changelog
- **GIVEN** `resolveReviewThread` returns an error for one threadId
- **WHEN** the handler runs the mutation
- **THEN** the handler warn-logs the error, continues to the next threadId, and still appends the changelog to the terminal status comment

### Requirement: Agent prompt SHALL document the JSON-emission contract

The `iterate-spec` prompt SHALL describe the `.openspec-flow/iteration-replies.json` schema, the `<sha>` substitution rule, the three `kind` values (`done`, `addressed`, `wontfix`), and the rule that the bot ignores its own comments (including prior inline replies) when selecting `commentId`s.

#### Scenario: Prompt covers all four contract points
- **WHEN** the handler renders the prompt
- **THEN** the rendered prompt mentions the JSON file path, the schema, the `<sha>` token, the three `kind` values, and the "ignore openspec-flow[bot]" rule applied to inline replies
