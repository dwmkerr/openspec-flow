# OIDC token broker

A small stateless endpoint hosted alongside the Probot App. Workflow
runners exchange a GitHub-signed OIDC ID token for a short-lived App
installation token. Target repos never need the App's private key
as a secret.

```
   USER'S RUNNER                       PROBOT (broker)               GITHUB
   ─────────────                       ─────────────────             ──────
   workflow                                                          
      │                                                              
      ├─► request OIDC ID token ────────────────────────────────►   mints
      │   (audience=openspec-flow)                                   token
      │                                                              
      │   ID token (RS256 JWT)                                       
      │   ◄────────────────────────────────────────────────────      
      │                                                              
      ├─► POST /api/token  ──► verify signature (JWKS)               
      │   Authorization:        verify iss = token.actions...        
      │   Bearer <id_token>     verify aud = openspec-flow           
      │                         verify job_workflow_ref matches      
      │                         dwmkerr/openspec-flow/.../...        
      │                         lookup installation id for repo      
      │                         mint installation token              
      │                                                              
      │   { token, expires_at, repository }                          
      │   ◄────────────────────                                      
      │                                                              
      ├─► git push (incl. workflow files)                            
```

## Setup

### Probot side

Set the audience env var to enable the route:

```bash
# .env
OPENSPEC_FLOW_BROKER_AUDIENCE=openspec-flow
```

The route mounts at `/api/token` when audience is set, no-op otherwise.
Probot logs `oidc-broker mounted at /api/token` on boot when active.

The broker uses the App's existing `APP_ID` + `PRIVATE_KEY_PATH` to
mint installation tokens — no extra secret distribution.

### Target repo side

The shim workflow needs:

1. `id-token: write` permission (added by the current shim template).
2. A repo or org variable `OPENSPEC_FLOW_BROKER_URL` pointing at the
   broker's host:

```bash
# repo level
gh variable set OPENSPEC_FLOW_BROKER_URL -R <owner>/<repo> -b "https://your-probot-host"

# or org level (covers every repo with the App installed)
gh variable set OPENSPEC_FLOW_BROKER_URL --org <org> -b "https://your-probot-host"
```

When `OPENSPEC_FLOW_BROKER_URL` is set, the reusable workflow:

- requests an OIDC token from GitHub
- POSTs it to `<BROKER_URL>/api/token`
- uses the returned installation token for git push + Octokit calls

When `OPENSPEC_FLOW_BROKER_URL` is empty, the workflow falls back to
the legacy `OPENSPEC_FLOW_APP_ID` + `OPENSPEC_FLOW_PRIVATE_KEY` secret
path. Both supported simultaneously during rollout.

## Trust model

Three claims are enforced in `src/oidc-broker/index.ts`:

| Claim | Check |
|---|---|
| `iss` | Equals `https://token.actions.githubusercontent.com` (GitHub's OIDC issuer) |
| `aud` | Equals the configured audience (default: `openspec-flow`) |
| `job_workflow_ref` (or `workflow_ref` fallback) | Matches the regex `^dwmkerr/openspec-flow/\.github/workflows/openspec-flow\.yml@` so a malicious workflow inside an installed repo cannot impersonate openspec-flow |

If any check fails, the broker returns 401.

If the repo named in the claim is not installed, the broker returns
403 (App lookup fails).

If the JWT is missing entirely, the broker returns 400.

## Why this is safe

- The OIDC token is signed by GitHub. The signing key is rotated by
  GitHub; the broker fetches and caches the JWKS automatically (via
  `jose.createRemoteJWKSet`).
- The token is short-lived (5–15 min depending on runner).
- The `audience` claim is configurable per broker, so reusing the
  broker for a different App requires explicitly changing the audience
  on both sides.
- The `job_workflow_ref` check prevents lateral movement — even a
  malicious workflow inside `dwmkerr/livedown` (which has the App
  installed) cannot mint a broker token because its
  `job_workflow_ref` would not match openspec-flow's reusable
  workflow path.

## Limitations (MVP)

- Token is not scope-narrowed. The minted installation token has all
  the App's repository permissions. Acceptable while the App's
  permission surface is small; revisit before adding broader perms.
- No audit log of mints beyond the existing structured log lines.
- No rate-limit on the endpoint. Each workflow run is one mint; not a
  realistic abuse vector for now.
- HSM-backed private key storage is out of scope for the local-dev
  prototype.

## Smoke testing locally

```bash
# terminal 1: Probot
OPENSPEC_FLOW_BROKER_AUDIENCE=openspec-flow npm run dev

# terminal 2: confirm route is mounted
curl -i -X POST http://127.0.0.1:3000/api/token
# expect: 400 {"error":"missing bearer token"}
```

For an end-to-end test against a live workflow, the Probot host needs
to be reachable from GitHub Actions runners. Cloudflared (free tier,
no interstitial) works for dev tunnels:

```bash
cloudflared tunnel --url http://127.0.0.1:3000
# copy the *.trycloudflare.com URL it prints
gh variable set OPENSPEC_FLOW_BROKER_URL -R <repo> -b "https://<...>.trycloudflare.com"
# trigger an event; check the broker-token step in the run log
```
