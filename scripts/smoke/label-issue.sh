#!/usr/bin/env bash
# Manufactures a fresh openspec:go event in the sandbox repo.
# Usage: scripts/smoke/label-issue.sh [issue-number]
# If no issue number is passed, creates a fresh issue first.

set -euo pipefail

REPO="${SANDBOX_REPO:-dwmkerr/openspec-flow}"

if [[ -z "${1:-}" ]]; then
  echo "Creating new issue in $REPO…"
  NUM=$(gh issue create -R "$REPO" \
    -t "smoke: add CSV export for order history" \
    -b "Users want CSV download. RFC 4180, UTF-8." \
    --json number -q .number)
  echo "Created issue #$NUM"
else
  NUM="$1"
fi

echo "Adding openspec:go label to #$NUM…"
gh issue edit "$NUM" -R "$REPO" --add-label openspec:go
echo "Done. Watch terminal 2 for handler output."
