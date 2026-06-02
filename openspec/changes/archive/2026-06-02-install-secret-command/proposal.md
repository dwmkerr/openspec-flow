## Why

`install` reported the `ANTHROPIC_API_KEY` status (present / missing / skipped) and then asked the user, in prose, to "ensure ANTHROPIC_API_KEY is set on the repo (Settings → Secrets)". The label-readiness section already prints concrete `gh label create` commands; secrets should follow the same pattern — print a copy-pasteable `gh secret set` example instead of a written instruction.

## What Changes

- When `ANTHROPIC_API_KEY` is missing or the secret check was skipped, `install` SHALL print:

  ```
  Set the required secret
    run this (install does not write to the repo):
    gh secret set ANTHROPIC_API_KEY  # Setup Anthropic key
  ```

  The `# Setup Anthropic key` annotation is rendered dim so the command stands out.

- When the secret is detected as present, the section is omitted.
- The next-steps list is simplified to: review diff → commit + open PR → label issue. The redundant "ensure ANTHROPIC_API_KEY is set" line is replaced by the printed command block above.
- `install` still performs no remote writes (mirrors the label-commands print-don't-execute rule).

## Capabilities

### Modified Capabilities

- `install`: extend the secret-state requirement to specify the printed `gh secret set` command for missing / unknown states.

## Impact

- **Affected code**: `src/install/index.ts` (new `renderSecretCommands` helper; next-steps trimmed).
- **Behaviour**: more concrete, less prose. No remote writes.
