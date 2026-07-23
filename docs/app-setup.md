# App Setup

One-time setup. ~5 minutes. Walks you from zero to a working `.env` file you can `npm run dev` against.

## What you'll have at the end

- A GitHub App registered to your account
- Private key file at `./private-key.pem`
- `.env` filled in
- Three labels created on your sandbox repo
- App installed on your sandbox repo

## Step 0 — register and activate the prod App

Two phases. **Phase 0a (claim)** can be done early to reserve the slug. **Phase 0b (activate)** wires up the live prod deployment and should be done when you're ready to deploy.

### Phase 0a — claim the slug (one minute)

Open: <https://github.com/settings/apps/new>

| Field | Value |
|---|---|
| GitHub App name | `OpenSpec Flow` |
| Homepage URL | `https://github.com/dwmkerr/openspec-flow` |
| Webhook → Active | ☐ unchecked (dormant for now) |
| Permissions | leave at defaults |

Click **Create GitHub App**. Slug `openspec-flow` is yours. Bot identity will eventually be `openspec-flow[bot]`. Leave it dormant.

### Phase 0b — activate for prod deploy

Open the App you created at <https://github.com/settings/apps/openspec-flow> and edit:

| Field | Value |
|---|---|
| Webhook → Active | ✅ checked |
| Webhook URL | `https://openspec-flow.fly.dev` |
| Webhook secret | run `openssl rand -hex 32` locally, paste, **save value for the Fly secret step** |

**Repository permissions** (same table as Step 1 below — keep dev and prod in sync):

| Permission | Access | Why |
|---|---|---|
| Contents | Read & write | commit + push to spec/impl branches |
| Issues | Read & write | label, comment, close |
| Pull requests | Read & write | open, comment, merge tracking |
| Workflows | Read & write | install-time init PR commits `.github/workflows/openspec-flow.yml` |
| Actions | Read | workflow-run telemetry |
| Checks | Read | check-suite events |

**Subscribe to events**: Issues, Issue comment, Pull request, Pull request review, Pull request review comment, Check suite, Workflow run.

**Where can this App be installed?** → `Any account` (prod is public).

Save changes. Note the **App ID** at the top.

Scroll to **Private keys** → **Generate a private key** → `.pem` downloads. Delete it after Step 0b is complete (it lives encrypted on Fly afterwards).

**Setup URL / Callback URL / OAuth options**: leave all blank/unchecked. openspec-flow uses installation tokens, not user OAuth.

#### Provision the Fly app and set secrets

```bash
# create the prod Fly app
fly apps create openspec-flow --org personal

# set all four secrets in one shot
fly secrets set -a openspec-flow \
  APP_ID="<the App ID number>" \
  WEBHOOK_SECRET="<the openssl rand -hex 32 value>" \
  PRIVATE_KEY="$(cat ~/Downloads/openspec-flow.YYYY-MM-DD.private-key.pem)" \
  OPENSPEC_FLOW_BROKER_AUDIENCE="openspec-flow"

# first deploy
flyctl deploy --remote-only --config fly.prod.toml -a openspec-flow

# verify
curl -i -X POST https://openspec-flow.fly.dev/api/token   # expect 400 {"error":"missing bearer token"}
fly logs -a openspec-flow                                  # expect Probot boot lines + "Listening on http://0.0.0.0:3000"

# clean up the private key from disk
rm ~/Downloads/openspec-flow.YYYY-MM-DD.private-key.pem
```

After this, prod is live. Subsequent updates go via the release pipeline (see [`release.md`](./release.md)); the manual `flyctl deploy` above is the escape hatch for incident response only.

> Why no Claude credential on prod? `fly.prod.toml` sets `OPENSPEC_FLOW_DISPATCH_MODE=action`, so the Fly host never invokes Claude — the agent runs on the target repo's GitHub Actions runner using `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`. Dev sometimes flips to `in-process` for local testing, which is why dev carries a key.

## Step 1 — register the dev App

Open: <https://github.com/settings/apps/new> again.

| Field | Value |
|---|---|
| GitHub App name | `OpenSpec Flow Dev <yourname>` |
| Homepage URL | `https://github.com/dwmkerr/openspec-flow` |
| Webhook → Active | ✅ checked |
| Webhook URL | `https://example.com` (placeholder — fix once tunnel is up) |
| Webhook secret | run `openssl rand -hex 32`, paste output |

Scroll down to **Repository permissions** and set:

| Permission | Access | Why |
|---|---|---|
| Contents | Read & write | commit + push to spec/impl branches |
| Issues | Read & write | label, comment, close |
| Pull requests | Read & write | open, comment, merge tracking |
| Workflows | Read & write | **required for the install-time init PR** — the commit includes `.github/workflows/openspec-flow.yml`, which GitHub gates behind a separate `workflows` scope. Without it, every init-PR commit fails with a 404 on `POST /git/trees` |
| Actions | Read | workflow-run telemetry |
| Checks | Read | check-suite events |

> If you registered the App before `Workflows: Read & write` was required and you're seeing 404s on init, edit the App's permissions then re-consent on each installation (GitHub shows a banner: "openspec-flow needs your review"). Installation tokens issued before the upgrade do not carry the new scope.

Scroll to **Subscribe to events** and check:

- Issues
- Issue comment
- Pull request
- Pull request review
- Pull request review comment
- Check suite
- Workflow run

Under **Where can this GitHub App be installed?** pick `Only on this account`.

Click **Create GitHub App**.

## Step 2 — generate the private key

You're now on the App's settings page.

1. Note the **App ID** at the top (a 6-7 digit number)
2. Scroll to **Private keys** → click **Generate a private key**
3. A `.pem` file downloads. Move it to the project root and rename:

```bash
mv ~/Downloads/openspec-flow-dev-*.pem /Users/Dave_Kerr/repos/scratch/openspec-flow/private-key.pem
```

The `.gitignore` already excludes `*.pem`. It will not be committed.

## Step 3 — install the App on your sandbox repo

Still on the App settings page:

1. Left sidebar → **Install App**
2. Click **Install** next to your account
3. Pick **Only select repositories** → choose `dwmkerr/openspec-flow` (or whichever repo you want to test against)
4. Click **Install**

On install, the App opens a setup PR in each selected repo (branch `chore/openspec-flow-init`, title `chore: openspec-flow setup`) containing the shim workflow + README managed regions. The PR body documents the recommended `gh secret set CLAUDE_CODE_OAUTH_TOKEN` step (or the API-key alternative) you need to run before merging. Re-installing on a repo that already has both the workflow file and README markers is a no-op (logged as `skipped: already-initialised`).

To preview what that PR would contain against any remote repo without running the App, use the CLI:

```bash
npx tsx src/cli.ts app-init --repo <owner/sandbox> --dry-run
```

## Step 4 — fill `.env`

```bash
cd /Users/Dave_Kerr/repos/scratch/openspec-flow
cp .env.example .env
```

Open `.env` and fill in:

```bash
APP_ID=<the App ID from step 2>
PRIVATE_KEY_PATH=./private-key.pem
WEBHOOK_SECRET=<the secret you generated in step 1>
ANTHROPIC_API_KEY=sk-ant-...
LOG_LEVEL=debug
```

## Step 5 — create the three labels

In your sandbox repo, create the labels the bot reacts to:

```bash
cd /Users/Dave_Kerr/repos/scratch/openspec-flow   # or your repo's working dir

gh label create "openspec:go"   -c "0969da" -d "Trigger: start or re-run openspec-flow" -f
gh label create "openspec:spec" -c "8250df" -d "Spec PR raised by openspec-flow"        -f
gh label create "openspec:impl" -c "1a7f37" -d "Implementation PR raised by openspec-flow" -f
```

`gh` picks up the repo from the current working directory. `-f` forces update if the label already exists. Color codes are hex without the `#`.

## Step 6 — verify

```bash
npm install
npm run dev
```

You should see Probot boot logs. The handler is registered but webhooks won't arrive yet — you still need the tunnel running (see [`developer-guide.md`](./developer-guide.md) § "Webhook tunnel"). Once the tunnel is up and the App's Webhook URL points at it, label an issue with `openspec:go` and watch terminal output.

## Troubleshooting

- **`Error: Invalid private key`** — `private-key.pem` is malformed or path is wrong in `.env`. Re-download from the App settings page.
- **`401 Bad credentials`** — `APP_ID` doesn't match the key. Re-check both in App settings.
- **No events arriving** — Webhook URL still points to `example.com`. Update it once the tunnel is running.
- **`403 Resource not accessible`** — App isn't installed on the repo, or missing a permission. Re-check step 1's permissions table and re-install.
