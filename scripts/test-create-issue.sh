#!/usr/bin/env bash
# Smoke test: deletes any existing test issue (identified by a label) and creates
# a fresh one labelled openspec:go to trigger the bot. Idempotent.
#
# Identifying issues by label keeps each test script isolated and lets us run
# them in parallel without collisions.

set -euo pipefail

REPO="${SANDBOX_REPO:-dwmkerr/openspec-flow}"
TEST_LABEL="test:create-issue-test"
TRIGGER_LABEL="openspec:go"
TITLE="smoke: add CSV export for order history"
BODY="Users want CSV download from the orders page. UTF-8, RFC 4180."

echo "→ ensuring label ${TEST_LABEL} exists"
gh label create "${TEST_LABEL}" -R "${REPO}" -c "ededed" -d "Issue created by scripts/test-create-issue.sh" -f >/dev/null

echo "→ deleting any prior test issues labelled ${TEST_LABEL}"
# --state all picks up closed ones too; --json then jq for numbers.
NUMS=$(gh issue list -R "${REPO}" --state all --label "${TEST_LABEL}" --json number -q '.[].number' || true)
if [[ -n "${NUMS}" ]]; then
  while read -r N; do
    [[ -z "$N" ]] && continue
    echo "  · deleting issue #${N}"
    gh issue delete "${N}" -R "${REPO}" --yes
  done <<< "${NUMS}"
else
  echo "  · none found"
fi

echo "→ creating fresh test issue"
ISSUE_URL=$(gh issue create -R "${REPO}" -t "${TITLE}" -b "${BODY}" -l "${TEST_LABEL}")
NEW_NUM=$(echo "${ISSUE_URL}" | awk -F/ '{print $NF}')
echo "  · created #${NEW_NUM} — ${ISSUE_URL}"

echo "→ applying ${TRIGGER_LABEL} to fire the bot"
gh issue edit "${NEW_NUM}" -R "${REPO}" --add-label "${TRIGGER_LABEL}" >/dev/null

echo "✓ done. watch terminal 2 for handler output."
