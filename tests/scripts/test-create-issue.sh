#!/usr/bin/env bash
# Smoke test: create-spec intent. Delete prior test issue, create a fresh
# one, apply openspec:go.

set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/_lib.sh"

LABEL="test:create-issue"
TITLE="smoke: add CSV export for order history"
BODY="Users want CSV download from the orders page. UTF-8, RFC 4180."

echo "→ delete prior $LABEL issues"
delete_issues_with_label "$LABEL"

echo "→ create fresh issue"
N=$(create_issue "$LABEL" "$TITLE" "$BODY")
echo "  · created #$N"

echo "→ apply $TRIGGER_LABEL"
gh issue edit "$N" -R "$REPO" --add-label "$TRIGGER_LABEL" >/dev/null

echo "✓ done — expect create-spec intent in terminal 2"
