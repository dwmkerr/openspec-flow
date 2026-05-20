#!/usr/bin/env bash
# Edge case: openspec:go on a PR with neither openspec:spec nor openspec:impl
# should yield a visible noop. Uses a throw-away branch to open a PR.

set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/_lib.sh"

LABEL="test:foreign-pr-noop"
BRANCH="test/foreign-pr-noop"

echo "→ clean prior $LABEL PRs"
close_prs_with_label "$LABEL"

echo "→ create a junk branch + PR"
git fetch origin main >/dev/null 2>&1
git checkout -q -B "$BRANCH" origin/main
printf "\n<!-- $LABEL -->\n" >> ideas.md
git add ideas.md
git commit -qm "test: foreign-pr-noop ($(date -u +%FT%TZ))"
git push -fq origin "$BRANCH"
ensure_label "$FIXTURE_LABEL" "d73a4a" "Test artefact — safe to delete"
PR_URL=$(gh pr create -R "$REPO" -t "test: foreign PR" -b "Throw-away PR for noop test." -l "$LABEL" -l "$FIXTURE_LABEL" -H "$BRANCH" -B main)
PR=$(echo "$PR_URL" | awk -F/ '{print $NF}')
printf "  · opened %s\n" "$(pr_link "$PR")"

echo "→ apply $TRIGGER_LABEL"
gh pr edit "$PR" -R "$REPO" --add-label "$TRIGGER_LABEL" >/dev/null

printf "✓ done — expect visible-noop comment on %s\n" "$(pr_link "$PR")"
echo "  cleanup: make test-cleanup ; git checkout main"
