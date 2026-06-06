// Jest setup. Strip GitHub Actions runner env vars so tests render
// deterministic status-comment bodies whether they run locally (no
// env set) or in CI (where GITHUB_RUN_ID + friends are injected by
// the runner). Without this, every assertion like
// `expect(body).toBe("✅ spec PR opened: #99")` fails in CI because
// renderRunLink appends `> 🔎 Watch: [run #...]`.
//
// Tests that specifically exercise the Action-context branch should
// pass their own env into the renderer (`renderRunLink({ GITHUB_RUN_ID: ... })`),
// not rely on the ambient env.

delete process.env.GITHUB_RUN_ID;
delete process.env.GITHUB_REPOSITORY;
delete process.env.GITHUB_SERVER_URL;
