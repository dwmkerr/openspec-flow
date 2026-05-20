#!/usr/bin/env bash
# Delete every issue and close every PR carrying test:fixture. The
# marker label is the single source of truth — anything without it is
# left alone. Idempotent: a second run finds nothing and exits 0.

set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/_lib.sh"

echo "→ scanning $REPO for $FIXTURE_LABEL artefacts"

issues=$(gh issue list -R "$REPO" --state all --label "$FIXTURE_LABEL" --json number -q '.[].number' 2>/dev/null || true)
prs=$(gh pr list -R "$REPO" --state all --label "$FIXTURE_LABEL" --json number -q '.[].number' 2>/dev/null || true)

issue_count=0
pr_count=0

if [[ -n "$issues" ]]; then
  while read -r n; do
    [[ -z "$n" ]] && continue
    printf "  · deleting %s\n" "$(issue_link "$n")"
    gh issue delete "$n" -R "$REPO" --yes
    issue_count=$((issue_count + 1))
  done <<< "$issues"
fi

if [[ -n "$prs" ]]; then
  while read -r n; do
    [[ -z "$n" ]] && continue
    printf "  · closing %s\n" "$(pr_link "$n")"
    gh pr close "$n" -R "$REPO" --delete-branch >/dev/null 2>&1 || \
      gh pr close "$n" -R "$REPO" >/dev/null 2>&1 || true
    pr_count=$((pr_count + 1))
  done <<< "$prs"
fi

total=$((issue_count + pr_count))
if [[ "$total" -eq 0 ]]; then
  echo "✓ nothing to clean"
else
  echo "✓ cleaned $issue_count issue(s) and $pr_count PR(s)"
fi
