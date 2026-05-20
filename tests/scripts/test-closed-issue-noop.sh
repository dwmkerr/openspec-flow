#!/usr/bin/env bash
# Edge case: openspec:go on a closed issue should yield a visible noop.

set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/_lib.sh"

LABEL="test:closed-issue-noop"
TITLE="smoke: closed issue gets visible noop"
BODY="Closed before openspec:go."

echo "→ delete prior $LABEL issues"
delete_issues_with_label "$LABEL"

echo "→ create issue + close it"
N=$(create_fixture_issue "$LABEL" "$TITLE" "$BODY")
gh issue close "$N" -R "$REPO" --reason "not planned" >/dev/null
printf "  · closed %s\n" "$(issue_link "$N")"

echo "→ apply $TRIGGER_LABEL to closed issue"
gh issue edit "$N" -R "$REPO" --add-label "$TRIGGER_LABEL" >/dev/null

printf "✓ done — expect visible-noop comment on %s\n" "$(issue_link "$N")"
