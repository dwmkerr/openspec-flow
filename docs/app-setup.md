# App Setup

One-time setup. ~5 minutes. Walks you from zero to a working `.env` file you can `npm run dev` against.

## What you'll have at the end

- A GitHub App registered to your account
- Private key file at `./private-key.pem`
- `.env` filled in
- Three labels created on your sandbox repo
- App installed on your sandbox repo

## Step 0 — claim the prod slug (one minute)

Before anything else, register the production App name so nobody else takes it. Open: <https://github.com/settings/apps/new>

| Field | Value |
|---|---|
| GitHub App name | `OpenSpec Flow` |
| Homepage URL | `https://github.com/dwmkerr/openspec-flow` |
| Webhook → Active | ☐ unchecked (dormant for now) |
| Permissions | leave at defaults |

Click **Create GitHub App**. Done. Slug `openspec-flow` is yours. Bot identity will eventually be `openspec-flow[bot]`. Leave it dormant.

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

| Permission | Access |
|---|---|
| Contents | Read & write |
| Issues | Read & write |
| Pull requests | Read & write |
| Workflows | Read & write |
| Actions | Read |
| Checks | Read |

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

Anthropic auth follows the same contract as Mode A. The Probot dev loop accepts either an API key (`ANTHROPIC_API_KEY`) or a Claude Code OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`); if both are set the API key wins. For the full Option 1 / Option 2 / both-set guidance, see the canonical block in the README: [Configure Anthropic auth](../README.md#configure-anthropic-auth).

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
