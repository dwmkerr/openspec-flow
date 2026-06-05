// App-install bootstrap core.
//
// Shared between the Probot `installation.created` handler and the
// `openspec-flow app-init` CLI. Reads remote repo state via the GitHub
// API, runs the same pure planner that drives `openspec-flow install`,
// and (unless dry-run) opens a PR on `chore/openspec-flow-init` that
// scaffolds the shim workflow + managed README regions.
//
// Idempotency contract — skip when the markers + workflow file are
// already present, or when an init PR is already open. Matches the
// CLI install three-state model so repeated installs are quiet.

import { plan, type Action, allNoop } from "../install/plan.js";
import { CONTRACT_LABELS } from "../install/detect.js";

const BRANCH = "chore/openspec-flow-init";
const PR_TITLE = "chore: openspec-flow setup";
const WORKFLOW_PATH = ".github/workflows/openspec-flow.yml";
const README_PATH = "README.md";

export interface AppInitDeps {
  octokit: any;
  log: { info: (m: string) => void; warn: (m: string) => void };
}

export interface AppInitRepo {
  owner: string;
  name: string;
  defaultBranch?: string;
}

export interface AppInitOpts {
  dryRun: boolean;
}

export interface PlannedFile {
  path: string;
  // Content length only — keep dry-run output scannable. Full content
  // is on the Action[] for callers that need it.
  contentLength: number;
}

export interface AppInitResult {
  repo: string;
  branch: string;
  prTitle: string;
  prBody: string;
  files: PlannedFile[];
  // Internal — full actions for the live writer. CLI dry-run prints
  // only `files` for brevity.
  actions: Action[];
  skipped?: "already-initialised" | "pr-already-open";
  prUrl?: string;
}

// Best-effort fetch of a single file from the default branch. Returns
// null on 404 so callers can treat missing files as a planning signal.
const fetchFile = async (
  octokit: any,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> => {
  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref });
    const data = res.data;
    if (Array.isArray(data) || data.type !== "file") return null;
    return Buffer.from(data.content, data.encoding ?? "base64").toString("utf8");
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
};

const resolveDefaultBranch = async (
  octokit: any,
  owner: string,
  repo: string,
): Promise<string> => {
  const res = await octokit.repos.get({ owner, repo });
  return res.data.default_branch as string;
};

// Preflight scope check.
//
// For CLI (PAT/OAuth) callers the OAuth scopes are returned in the
// `x-oauth-scopes` header on any authed request. For GitHub App
// installation tokens the header is absent and there is no analogous
// endpoint that lists per-installation permissions from the token's
// own side, so we skip the check there — the App's permission manifest
// (and re-consent) is the source of truth. Returns `null` when the
// caller is an App installation (no `x-oauth-scopes` available).
const probeOauthScopes = async (
  octokit: any,
): Promise<string[] | null> => {
  const res = await octokit.request("GET /");
  const header = res.headers?.["x-oauth-scopes"];
  if (typeof header !== "string") return null;
  return header.split(",").map((s) => s.trim()).filter(Boolean);
};

const assertCanWriteWorkflows = async (
  octokit: any,
  willWriteWorkflow: boolean,
): Promise<void> => {
  if (!willWriteWorkflow) return;
  const scopes = await probeOauthScopes(octokit);
  // null = App installation token; permission check happens server-side
  // (re-consent on the App's permission manifest). Skip the preflight
  // and let createTree surface a named error if the App was
  // misconfigured.
  if (scopes === null) return;
  if (!scopes.includes("workflow")) {
    throw new Error(
      "token missing 'workflow' OAuth scope, required to write " +
        ".github/workflows/openspec-flow.yml. Fix: 'gh auth refresh -s workflow'.",
    );
  }
};

// Ensure the three contract labels exist. createLabel is idempotent
// in spirit — GitHub returns 422 when the name already exists, which
// we treat as success so a re-run is quiet. Color/description on
// existing labels are not reconciled; the user owns their look.
const ensureContractLabels = async (
  octokit: any,
  owner: string,
  repo: string,
  log: { info: (m: string) => void; warn: (m: string) => void },
): Promise<void> => {
  for (const label of CONTRACT_LABELS) {
    try {
      await octokit.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
      log.info(`  + label '${label.name}' created`);
    } catch (err: any) {
      if (err?.status === 422) continue; // already exists
      log.warn(`  label '${label.name}' create failed: ${err?.message ?? String(err)}`);
    }
  }
};

const hasOpenInitPR = async (
  octokit: any,
  owner: string,
  repo: string,
): Promise<boolean> => {
  const res = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    head: `${owner}:${BRANCH}`,
  });
  return res.data.length > 0;
};

const renderPrBody = (owner: string, name: string): string => {
  const slug = `${owner}/${name}`;
  return [
    "openspec-flow setup",
    "",
    "This PR was opened automatically by the openspec-flow GitHub App on install. Merging it wires this repository into the spec-driven flow.",
    "",
    "## What this PR adds",
    "",
    `- \`${WORKFLOW_PATH}\` — the reusable-workflow shim that drives the flow on every \`openspec:go\` label.`,
    "- A badge under the README H1 linking to the workflow's runs.",
    "- A short README block describing the user-facing flow.",
    "",
    "## Already done outside this PR",
    "",
    "- The three contract labels (`openspec:go`, `openspec:spec`, `openspec:impl`) have been created on this repo. Re-creating an existing label is a no-op so a re-install is quiet.",
    "",
    "## Before merging — set Actions secrets",
    "",
    "openspec-flow workflows act with App-bot identity to push branches and open PRs. That needs three secrets on this repository (the App can't write them for you):",
    "",
    "```bash",
    `gh secret set ANTHROPIC_API_KEY    -R ${slug}      # value: your Anthropic API key`,
    `gh secret set OPENSPEC_FLOW_APP_ID -R ${slug} -b "<APP_ID>"`,
    `gh secret set OPENSPEC_FLOW_PRIVATE_KEY -R ${slug} < private-key.pem`,
    "```",
    "",
    "Without `ANTHROPIC_API_KEY`, the agent can't run. Without the App secrets, the workflow falls back to `GITHUB_TOKEN` which (a) can't push workflow file changes (`.github/workflows/*`) and (b) attributes commits to `github-actions[bot]` rather than the openspec-flow App.",
    "",
    "> **Less repo-by-repo friction**: set `OPENSPEC_FLOW_PRIVATE_KEY` once as an **organisation secret** so every repo in the org inherits it. See https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-an-organization",
    "",
    "> A future change ([issue here](https://github.com/dwmkerr/openspec-flow/issues)) removes the private-key-as-repo-secret requirement by minting tokens via OIDC against a stateless openspec-flow broker endpoint. Until then, secrets are the standard path (same model as Renovate).",
    "",
    "## After merging",
    "",
    "1. Open an issue describing a feature, fix, or task.",
    "2. Add the `openspec:go` label.",
    "3. openspec-flow opens a spec PR. Review, iterate, merge.",
    "4. openspec-flow opens an impl PR. Review, iterate, merge.",
    "",
    "See https://github.com/dwmkerr/openspec-flow for the full docs.",
  ].join("\n");
};

const writeFiles = async (
  octokit: any,
  owner: string,
  repo: string,
  baseBranch: string,
  actions: Action[],
): Promise<{ commitSha: string }> => {
  // Resolve the base commit + tree.
  const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
  const baseSha = baseRef.data.object.sha;
  const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });

  // Build blobs for every non-noop action.
  const writes = actions.filter((a) => a.kind !== "noop");
  const blobs: { path: string; sha: string }[] = [];
  for (const action of writes) {
    const blob = await octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(action.content, "utf8").toString("base64"),
      encoding: "base64",
    });
    blobs.push({ path: action.path, sha: blob.data.sha });
  }

  const writesWorkflowFile = writes.some((a) => a.path.startsWith(".github/workflows/"));
  let tree: any;
  try {
    tree = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.data.tree.sha,
      tree: blobs.map((b) => ({
        path: b.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: b.sha,
      })),
    });
  } catch (err: any) {
    // GitHub returns 404 (not 403) on createTree when the token can't
    // write a path it would otherwise be authorised to read — most
    // commonly because the commit touches `.github/workflows/*` and the
    // token lacks the `workflow` scope (App: `Workflows: Read & write`).
    if (err?.status === 404 && writesWorkflowFile) {
      throw new Error(
        `createTree returned 404 — token likely missing 'workflow' scope ` +
          `(GitHub App: 'Workflows: Read & write'). The init commit writes ` +
          `.github/workflows/openspec-flow.yml which is gated separately ` +
          `from regular contents. CLI fix: 'gh auth refresh -s workflow'. ` +
          `App fix: enable Workflows: Read & write on the App and re-consent.`,
      );
    }
    throw err;
  }

  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message: PR_TITLE,
    tree: tree.data.sha,
    parents: [baseSha],
  });

  // Create the branch ref pointing at the new commit. If the ref
  // already exists (e.g. abandoned branch from a previous attempt),
  // force-update it.
  try {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${BRANCH}`,
      sha: commit.data.sha,
    });
  } catch (err: any) {
    if (err?.status === 422) {
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${BRANCH}`,
        sha: commit.data.sha,
        force: true,
      });
    } else {
      throw err;
    }
  }

  return { commitSha: commit.data.sha };
};

export const runAppInit = async (
  deps: AppInitDeps,
  repo: AppInitRepo,
  opts: AppInitOpts,
): Promise<AppInitResult> => {
  const { octokit, log } = deps;
  const { owner, name } = repo;
  const slug = `${owner}/${name}`;
  const defaultBranch =
    repo.defaultBranch ?? (await resolveDefaultBranch(octokit, owner, name));

  // Snapshot existing remote state so the planner runs against real
  // contents — same shape `openspec-flow install` feeds locally.
  const workflow = await fetchFile(octokit, owner, name, WORKFLOW_PATH, defaultBranch);
  const readme = await fetchFile(octokit, owner, name, README_PATH, defaultBranch);

  const actions = plan(
    { cwd: "", workflow, readme, remote: slug },
    { force: false },
  );

  const prBody = renderPrBody(owner, name);
  const files: PlannedFile[] = actions
    .filter((a) => a.kind !== "noop")
    .map((a) => ({ path: a.path, contentLength: a.content.length }));

  const base: AppInitResult = {
    repo: slug,
    branch: BRANCH,
    prTitle: PR_TITLE,
    prBody,
    files,
    actions,
  };

  // Label provisioning runs ahead of the idempotency check so a repo
  // that already has the files but is missing labels still gets them
  // (common when the repo was init'd before this code existed). Best-
  // effort: missing labels can be created manually if the API fails.
  if (!opts.dryRun) {
    await ensureContractLabels(octokit, owner, name, log);
  }

  // Idempotency — both file/marker checks are encoded in the planner's
  // noop output, so a single `allNoop` matches the CLI install contract.
  if (allNoop(actions)) {
    log.info(`${slug}: skipped — already-initialised`);
    return { ...base, skipped: "already-initialised" };
  }

  // Check for a pre-existing init PR before doing anything destructive.
  if (await hasOpenInitPR(octokit, owner, name)) {
    log.info(`${slug}: skipped — pr-already-open`);
    return { ...base, skipped: "pr-already-open" };
  }

  if (opts.dryRun) {
    log.info(`${slug}: dry-run — would write ${files.length} file(s) on ${BRANCH}`);
    return base;
  }

  // Preflight: fail fast with a named error if the OAuth token can't
  // write workflow files. Skipped for App installation tokens (no
  // `x-oauth-scopes` header) — those rely on the App's permission
  // manifest and would still surface the createTree-404 named error.
  const willWriteWorkflow = actions.some(
    (a) => a.kind !== "noop" && a.path.startsWith(".github/workflows/"),
  );
  await assertCanWriteWorkflows(octokit, willWriteWorkflow);

  await writeFiles(octokit, owner, name, defaultBranch, actions);

  const pr = await octokit.pulls.create({
    owner,
    repo: name,
    title: PR_TITLE,
    head: BRANCH,
    base: defaultBranch,
    body: prBody,
  });

  log.info(`${slug}: opened ${pr.data.html_url}`);
  return { ...base, prUrl: pr.data.html_url };
};
