// OIDC token broker — stateless endpoint that exchanges a
// GitHub-issued OIDC ID token for a GitHub App installation token.
//
// Goal: target repos can mint an App-bot token at workflow runtime
// without storing the App's private key as a repo (or org) secret.
// The private key stays here; the runner sends its short-lived OIDC
// token as proof of "I'm a workflow running in repo X for App Y".
//
// Trust model (MVP, see #79 for the long form):
//   1. The JWT must be signed by GitHub's OIDC issuer (verified
//      against JWKS).
//   2. The `aud` claim must equal the configured broker audience.
//   3. The `iss` claim must be GitHub's well-known OIDC issuer.
//   4. The repo named in the `repository` claim must be one this
//      GitHub App is installed on (looked up via the App JWT — the
//      private key is the proof).
//   5. The `workflow_ref` claim must match the openspec-flow
//      reusable workflow pattern, so a malicious workflow inside an
//      installed repo can't mint a broker token for itself by
//      pretending to be openspec-flow.
//
// Returns a fresh installation token (default 1h GitHub-side TTL).

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;

// JWKS is fetched lazily and cached by `jose`. Module-level so all
// requests share one cache; refreshes automatically per the
// remote-JWKS contract.
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const getJwks = (): ReturnType<typeof createRemoteJWKSet> => {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(GITHUB_OIDC_JWKS_URL));
  }
  return cachedJwks;
};

export interface BrokerConfig {
  // The `aud` claim the broker requires. Apps SHOULD pick a unique
  // value (e.g. "openspec-flow") rather than the default GitHub
  // server URL — it ensures the OIDC token was issued for THIS
  // broker, not some other service the repo happens to also trust.
  audience: string;
  // Regex matching acceptable `workflow_ref` values. Default matches
  // the openspec-flow reusable workflow at any ref so a malicious
  // workflow inside an installed repo can't impersonate openspec-flow.
  workflowRefPattern?: RegExp;
  // Optional override for unit tests. Defaults to the live GitHub
  // OIDC JWKS endpoint.
  jwksUrl?: string;
}

export interface OidcClaims extends JWTPayload {
  repository?: string;
  repository_id?: string;
  repository_owner?: string;
  workflow_ref?: string;
  ref?: string;
  job_workflow_ref?: string;
}

export interface VerifiedClaims {
  repository: string; // "owner/name"
  workflowRef: string;
  jobWorkflowRef: string | null;
}

const DEFAULT_WORKFLOW_REF_PATTERN =
  /^dwmkerr\/openspec-flow\/\.github\/workflows\/openspec-flow\.yml@/;

// Verify the OIDC ID token + return the claims the broker uses.
// Throws on any failure so callers map to 401 cleanly.
export const verifyOidcToken = async (
  idToken: string,
  config: BrokerConfig,
): Promise<VerifiedClaims> => {
  const jwks = config.jwksUrl
    ? createRemoteJWKSet(new URL(config.jwksUrl))
    : getJwks();

  const { payload } = await jwtVerify<OidcClaims>(idToken, jwks, {
    issuer: GITHUB_OIDC_ISSUER,
    audience: config.audience,
  });

  if (!payload.repository) {
    throw new Error("OIDC claim missing `repository`");
  }
  if (!payload.workflow_ref) {
    throw new Error("OIDC claim missing `workflow_ref`");
  }

  // job_workflow_ref is set when the workflow CALLS a reusable
  // workflow; it points at the reusable workflow's repo path. For
  // openspec-flow, this is the shim invoking dwmkerr/openspec-flow's
  // reusable workflow. workflow_ref alone is the caller's path,
  // which is the shim itself (not very useful for our check).
  const refForCheck = payload.job_workflow_ref ?? payload.workflow_ref;
  const pattern = config.workflowRefPattern ?? DEFAULT_WORKFLOW_REF_PATTERN;
  if (!pattern.test(refForCheck)) {
    throw new Error(
      `OIDC claim 'job_workflow_ref'/'workflow_ref' does not match ` +
        `expected pattern (got '${refForCheck}')`,
    );
  }

  return {
    repository: payload.repository,
    workflowRef: payload.workflow_ref,
    jobWorkflowRef: payload.job_workflow_ref ?? null,
  };
};

export interface InstallationTokenIssuer {
  // Resolve installation id for a repo. Implementations use the
  // App JWT to call GET /repos/{owner}/{repo}/installation. Split
  // out so tests can stub.
  getInstallationId: (
    owner: string,
    repo: string,
  ) => Promise<number>;
  // Mint a fresh installation token for the given installation id.
  // Implementations use @octokit/auth-app's `installation` strategy.
  mintToken: (
    installationId: number,
  ) => Promise<{ token: string; expiresAt: string }>;
}

export interface BrokerSuccess {
  token: string;
  expires_at: string;
  repository: string;
}

export interface BrokerFailure {
  status: 400 | 401 | 403 | 500;
  error: string;
}

// Top-level broker entry point — verifies the OIDC token, mints an
// installation token, returns either the success body or a structured
// failure for the HTTP adapter to render.
export const broker = async (
  idToken: string | null,
  config: BrokerConfig,
  issuer: InstallationTokenIssuer,
  log: { info: (m: string) => void; warn: (m: string) => void },
): Promise<BrokerSuccess | BrokerFailure> => {
  if (!idToken) {
    return { status: 400, error: "missing bearer token" };
  }
  let claims: VerifiedClaims;
  try {
    claims = await verifyOidcToken(idToken, config);
  } catch (err: any) {
    log.warn(`oidc verify failed: ${err?.message ?? String(err)}`);
    return { status: 401, error: `oidc verification failed: ${err?.message ?? "unknown"}` };
  }

  const [owner, repo] = claims.repository.split("/");
  if (!owner || !repo) {
    return { status: 400, error: `malformed repository claim: ${claims.repository}` };
  }

  let installationId: number;
  try {
    installationId = await issuer.getInstallationId(owner, repo);
  } catch (err: any) {
    log.warn(`installation lookup failed: ${err?.message ?? String(err)}`);
    return {
      status: 403,
      error: `App is not installed on ${claims.repository}, or installation lookup failed`,
    };
  }

  try {
    const minted = await issuer.mintToken(installationId);
    log.info(`broker minted token for ${claims.repository} (installation ${installationId})`);
    return {
      token: minted.token,
      expires_at: minted.expiresAt,
      repository: claims.repository,
    };
  } catch (err: any) {
    log.warn(`token mint failed: ${err?.message ?? String(err)}`);
    return { status: 500, error: `token mint failed: ${err?.message ?? "unknown"}` };
  }
};
