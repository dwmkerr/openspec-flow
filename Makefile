default: help

.PHONY: help
help: # Show help for each of the Makefile recipes.
	@grep -E '^[a-zA-Z0-9 -]+:.*#'  Makefile | sort | while read -r l; do printf "\033[1;32m$$(echo $$l | cut -f 1 -d':')\033[00m:$$(echo $$l | cut -f 2- -d'#')\n"; done

.PHONY: dev
dev: # Run the Probot dev server with hot reload.
	npm run dev

.PHONY: tunnel
tunnel: # Run the ngrok tunnel for local webhook delivery.
	npm run dev:tunnel

.PHONY: test
test: # Run all Jest tests (unit + integration).
	npm run test:all

.PHONY: lint
lint: # Run linters and formatters.
	npm run lint

.PHONY: typecheck
typecheck: # Type-check the TypeScript source.
	npm run typecheck

.PHONY: build
build: # Compile TypeScript to dist/.
	npm run build

.PHONY: test-create-issue
test-create-issue: # Smoke test: create-spec intent. Fresh issue + openspec:go.
	./tests/scripts/test-create-issue.sh

.PHONY: test-closed-issue-noop
test-closed-issue-noop: # Edge case: openspec:go on a closed issue. Expect visible noop.
	./tests/scripts/test-closed-issue-noop.sh

.PHONY: test-foreign-pr-noop
test-foreign-pr-noop: # Edge case: openspec:go on a non-lifecycle PR. Expect visible noop.
	./tests/scripts/test-foreign-pr-noop.sh
