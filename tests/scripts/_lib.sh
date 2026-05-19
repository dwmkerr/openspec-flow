#!/usr/bin/env bash
# Shared helpers for tests/scripts/*. Each script identifies its artefacts by a
# unique `test:<scenario>` label so runs are isolated and idempotent.

set -euo pipefail

REPO="${SANDBOX_REPO:-dwmkerr/openspec-flow}"
TRIGGER_LABEL="openspec:go"
SPEC_LABEL="openspec:spec"
IMPL_LABEL="openspec:impl"

ensure_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" -R "$REPO" -c "$color" -d "$desc" -f >/dev/null
}

delete_issues_with_label() {
  local label="$1"
  local nums
  nums=$(gh issue list -R "$REPO" --state all --label "$label" --json number -q '.[].number' || true)
  if [[ -n "$nums" ]]; then
    while read -r n; do
      [[ -z "$n" ]] && continue
      echo "  · deleting issue #$n"
      gh issue delete "$n" -R "$REPO" --yes
    done <<< "$nums"
  fi
}

close_prs_with_label() {
  local label="$1"
  local nums
  nums=$(gh pr list -R "$REPO" --state all --label "$label" --json number -q '.[].number' || true)
  if [[ -n "$nums" ]]; then
    while read -r n; do
      [[ -z "$n" ]] && continue
      echo "  · closing PR #$n"
      gh pr close "$n" -R "$REPO" --delete-branch >/dev/null 2>&1 || true
    done <<< "$nums"
  fi
}

create_issue() {
  local test_label="$1" title="$2" body="$3"
  ensure_label "$test_label" "ededed" "Issue created by tests/scripts" >/dev/null
  local url num
  url=$(gh issue create -R "$REPO" -t "$title" -b "$body" -l "$test_label")
  num=$(echo "$url" | awk -F/ '{print $NF}')
  echo "$num"
}
