#!/usr/bin/env bash
# Shared helpers for tests/scripts/*. Each script identifies its artefacts by a
# unique `test:<scenario>` label so runs are isolated and idempotent.

set -euo pipefail

REPO="${SANDBOX_REPO:-dwmkerr/openspec-flow}"
TRIGGER_LABEL="openspec:go"
SPEC_LABEL="openspec:spec"
IMPL_LABEL="openspec:impl"
FIXTURE_LABEL="test:fixture"

# OSC 8 hyperlink — clickable in iTerm2, kitty, wezterm, recent tmux,
# VS Code terminal. Plain terminals degrade to showing TEXT only.
link() {
  local url="$1" text="$2"
  printf '\033]8;;%s\033\\%s\033]8;;\033\\' "$url" "$text"
}

issue_url() { echo "https://github.com/$REPO/issues/$1"; }
pr_url()    { echo "https://github.com/$REPO/pull/$1"; }

issue_link() { link "$(issue_url "$1")" "issue #$1"; }
pr_link()    { link "$(pr_url "$1")"    "PR #$1"; }

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

# Create an issue that carries both the scenario label and the shared
# test:fixture marker. `make test-cleanup` keys off the marker, so every
# fixture MUST go through this helper (or back-fill the marker later).
create_fixture_issue() {
  local test_label="$1" title="$2" body="$3"
  ensure_label "$FIXTURE_LABEL" "d73a4a" "Test artefact — safe to delete" >/dev/null
  ensure_label "$test_label" "ededed" "Issue created by tests/scripts" >/dev/null
  local url num
  url=$(gh issue create -R "$REPO" -t "$title" -b "$body" -l "$test_label" -l "$FIXTURE_LABEL")
  num=$(echo "$url" | awk -F/ '{print $NF}')
  echo "$num"
}
