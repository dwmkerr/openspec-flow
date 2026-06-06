# Deploy on Fly.io

openspec-flow ships with a Dockerfile + `fly.toml` for Fly.io. One
small VM hosts both the webhook receiver and the OIDC token broker.

This page covers two Fly deployments — one for development, one for
production — and the matrix of which dev mode you use when.

## Why Fly

- Free tier covers the expected request volume (≤ a few req/min).
- Stable public URL — no cloudflared tunnel restart dance for the
  broker.
- Node runtime — no porting Probot to a Workers-compatible shape.
- One command deploy from git checkout.

## Deployment matrix

| Mode | Probot host | Webhook URL on App | Broker URL on target repo |
|---|---|---|---|
| **Full local** | `make dev` | smee → localhost | `https://openspec-flow-dev.fly.dev` (or cloudflared tunnel) |
| **Fly dev** | `openspec-flow-dev.fly.dev` | `https://openspec-flow-dev.fly.dev` | `https://openspec-flow-dev.fly.dev` |
| **Fly prod** | `openspec-flow.fly.dev` | `https://openspec-flow.fly.dev` | `https://openspec-flow.fly.dev` |

Webhook URL and broker URL are independent: an App's webhook URL is
set in App settings; the broker URL is a per-target-repo (or per-org)
Actions variable. So you can mix and match — e.g. webhooks stay on
smee for fast handler-code iteration, but broker calls go to
`openspec-flow-dev.fly.dev` for a stable test environment.

## First-time setup (per deployment)

```bash
# install
brew install flyctl
fly auth login

# from the repo root, create the app (different names for dev / prod)
fly launch --no-deploy --copy-config --name openspec-flow-dev
# (or `openspec-flow` for prod)

# secrets — the same set the .env documents for local dev
fly secrets set -a openspec-flow-dev \
  APP_ID="$APP_ID" \
  WEBHOOK_SECRET="$WEBHOOK_SECRET" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  OPENSPEC_FLOW_BROKER_AUDIENCE="openspec-flow-dev"

# private key — multi-line, easier from file
fly secrets set -a openspec-flow-dev \
  PRIVATE_KEY="$(cat private-key.pem)" \
  PRIVATE_KEY_PATH="/dev/stdin"

# deploy
fly deploy -a openspec-flow-dev
```

> Note on `PRIVATE_KEY_PATH`: the existing code reads the private key
> from a file at `PRIVATE_KEY_PATH`. The simplest way to wire that on
> Fly is to set both `PRIVATE_KEY` and `PRIVATE_KEY_PATH` and have a
> tiny entrypoint write the secret to disk. See
> `scripts/fly-entrypoint.sh` for the pattern, or refactor
> `src/server.ts` to accept `PRIVATE_KEY` directly.

## After first deploy

```bash
# verify the broker route mounted
curl -i -X POST https://openspec-flow-dev.fly.dev/api/token
# expect: 400 {"error":"missing bearer token"}

# verify webhook reachability — open a sandbox repo's App config
# and set Webhook URL to https://openspec-flow-dev.fly.dev (no path).
# Trigger any event and check logs:
fly logs -a openspec-flow-dev
```

## Updating

```bash
fly deploy -a openspec-flow-dev   # rebuild image, rolling deploy
```

The Dockerfile installs `npm ci`, builds, and runs `node dist/server.js`.
Each deploy is ~2–3 minutes.

## Three local-dev workflows

You don't have to commit to one mode. Pick per-task:

### A. Full local

Both webhook and broker on your laptop. Fastest iteration on handler
code.

```bash
make tunnel    # smee proxy → localhost:3000
make dev       # Probot
```

- App webhook URL: `https://smee.io/<channel>`
- Repo broker URL: not set (legacy App-secret path) OR `https://<cloudflared>.trycloudflare.com` if you want to test the broker locally

### B. Hybrid (webhooks local, broker on Fly dev)

Iterate on handler code locally with smee, while broker is stable
on Fly dev.

```bash
make tunnel    # smee for webhooks
make dev       # local Probot handles webhooks
# Fly dev keeps running; target repos point broker at Fly dev URL
```

- App webhook URL: `https://smee.io/<channel>` (local)
- Repo broker URL: `https://openspec-flow-dev.fly.dev` (Fly dev)

### C. Full Fly dev

Both webhook and broker on Fly dev. Closest to prod posture; useful
when you've finished local iteration and want to verify the deployed
shape end-to-end before pushing to prod.

```bash
fly deploy -a openspec-flow-dev
```

- App webhook URL: `https://openspec-flow-dev.fly.dev`
- Repo broker URL: `https://openspec-flow-dev.fly.dev`

## Switching between modes

Switching is a one-line change in two places — neither requires a
redeploy:

1. App settings → Webhook URL → set to the desired host
2. Target repo Actions variable `OPENSPEC_FLOW_BROKER_URL` → set to
   the desired broker host (or unset to use legacy secrets)

Probot doesn't care which mode is active; it just serves whatever
comes in.

## Cost

- Free tier: 3 shared-cpu VMs × 256MB RAM, $0/mo.
- Auto-stops on idle (`auto_stop_machines = "stop"`) → ~$0 even when
  exceeding free tier.
- Cold start on first webhook after idle: ~1s.
