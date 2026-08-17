# ihute-frontend — Bitbucket Pipelines CI/CD

Automated build and deploy to the DigitalOcean server (`ubuntu-s-8vcpu-16gb-ams3-01`).

## Server layout

| Path | Environment | Site | Git branch | PM2 name |
|------|-------------|------|------------|----------|
| `/var/www/ihute-frontend` | Production | ihute.rw | `master` or `main` | `ihute-frontend` |
| `/var/www/ihute-frontend-dev` | Dev | dev.ihute.rw | `master` (auto on push) | `ihute-dev` |
| `/var/www/ihute-frontend_beta` | Beta | beta.ihute.rw | `beta` | `ihute-beta` |
| `/var/www/grandma-ihute` | Grandma | shop.ihute.rw | `GRANDMA` | `ihute-grandma` |

Each directory is its own git clone with its own `.env` (never committed). Builds run **on the server** so `NEXT_PUBLIC_*` values come from that environment’s `.env`.

## One-time server setup

SSH into the server as a user that can deploy (root or a dedicated `deploy` user).

### 1. Install runtime tools

```bash
# Node 22 (matches bitbucket-pipelines.yml)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# PM2
sudo npm install -g pm2
```

### 2. Clone the repo into each deploy path

Replace `YOUR_WORKSPACE/ihute-frontend` with your Bitbucket git URL.

```bash
sudo mkdir -p /var/www
cd /var/www

sudo git clone git@bitbucket.org:YOUR_WORKSPACE/ihute-frontend.git ihute-frontend
sudo git clone git@bitbucket.org:YOUR_WORKSPACE/ihute-frontend.git ihute-frontend-dev
sudo git clone git@bitbucket.org:YOUR_WORKSPACE/ihute-frontend.git ihute-frontend_beta
sudo git clone git@bitbucket.org:YOUR_WORKSPACE/ihute-frontend.git grandma-ihute

cd ihute-frontend-dev && sudo git checkout master
cd /var/www/ihute-frontend_beta && sudo git checkout beta
cd /var/www/grandma-ihute && sudo git checkout GRANDMA
```

### 3. Environment files

Copy and edit per environment (examples in the repo):

```bash
# Dev
cp /var/www/ihute-frontend-dev/.env.dev.example /var/www/ihute-frontend-dev/.env

# Beta / production — create .env on the server with production URLs and secrets
nano /var/www/ihute-frontend_beta/.env
nano /var/www/ihute-frontend/.env
nano /var/www/grandma-ihute/.env
```

Dev defaults are documented in [`.env.dev.example`](../.env.dev.example) (`PORT=3007`, `Trading_dev` WAR, etc.).

**Grandma Search** talks to Java/Tomcat only (`JAVA_BACKEND_BASE` or `BACKEND_URL` → `GET {base}/grandma/search`). Git pull does **not** copy server `.env` values. Grandma Search does **not** require Next.js MySQL credentials (`ONBOARDING_MYSQL_*`, `EBM_MYSQL_*`, `GQ_MYSQL_*`, `DB_URL`). Missing those keys must not make `/api/grandma/search` return “database not configured”.

Frontend (this repo) and the Java Trading WAR are **separate artifacts**. Search works only when **both** are deployed: Next.js pointing at `JAVA_BACKEND_BASE`/`BACKEND_URL`, and a WAR that includes `grandmaAPIs.GrandmaSearchServlet` mapped to `/grandma/search` (and `/Api/grandma/search`). A frontend git pull does not install the servlet.

Resolver order for the Java base: `JAVA_BACKEND_BASE` → `BACKEND_URL` → `NEXT_PUBLIC_API_URL` (when it looks like a Trading WAR) → local/production defaults.

**Other Grandma features that still use Next.js MySQL** (keep their config; do not delete it):

- Seller GPS persist (`lib/grandma-seller-gps-persist.ts`)
- Onboarding drafts (`lib/onboarding-draft-persist.ts`)
- Client suggestions (`lib/client-suggestion.ts`)
- Admin sellers / pending drafts (`app/api/admin/grandma/...`)
- EBM / order helpers that call `getOnboardingMysqlConfig()`

Those features still resolve `ONBOARDING_MYSQL_*` → `EBM_MYSQL_*` → `FORGOT_PASSWORD_MYSQL_*` → `SUPPLIER_STOCK_MYSQL_*` → `GQ_MYSQL_*` → `MYSQL_*` → `DB_URL`+`DB_USER`+`DB_PASS`. Bitbucket Pipelines **does not** inject MySQL secrets. `scripts/deploy-remote.sh` may still import allowlisted MySQL keys from Tomcat `.env` for those non-Search features. Values are never logged.

If production already has `GQ_MYSQL_*` or Tomcat `DB_*`, **do not** add `ONBOARDING_MYSQL_*` unless those are incomplete.

On the DEV host (`/var/www/ihute-frontend-dev/.env`):

1. Set **`JAVA_BACKEND_BASE`** (or `BACKEND_URL`) to this host’s Trading WAR, e.g. `http://127.0.0.1:8080/Trading_dev`.
2. Confirm Java is up: `curl -sS "$JAVA_BACKEND_BASE/grandma/search?q=milk&sector=boutique&limit=5"`
3. Restart: `pm2 restart ihute-dev --update-env`
4. Check Next.js Search: `curl -sS "https://dev.ihute.rw/api/grandma/search?q=milk&page=1&pageSize=5"` then Near Me  
   `.../api/grandma/search?q=&nearMe=1&lat=-1.9441&lng=30.0619&radiusKm=1&page=1&pageSize=5`  
   should include `"ok": true, "source": "java"`. The public JSON must not include `mysqlConfig`, host, user, schema, or `MYSQL_NOT_CONFIGURED`.

Presence-only check for remaining MySQL features: `npx tsx scripts/check-onboarding-mysql-env.ts` from the clone directory.

### 3b. Bitbucket git pull on the server (fix `Permission denied (publickey)`)

The server clone uses `git@bitbucket.org:...` but has **no SSH key** for Bitbucket. The pipeline SSH password (`DEPLOY_PASS`) only logs into the server — it does **not** authenticate `git pull`.

**Option A — HTTPS + credential helper (what you started)** — one-time setup per server user:

```bash
cd /var/www/ihute-frontend-dev
git remote set-url origin https://UwAngelique@bitbucket.org/Kimenyi/ihute-frontend.git
git config credential.helper store
git pull origin master
```

When prompted for **Password**, paste a **Bitbucket App Password** (not your login password).

Create one: **Bitbucket → Personal settings → App passwords** → permission **Repositories: Read**.

Credentials are saved in `~/.git-credentials` and reused by the deploy pipeline.

Verify:

```bash
git log -1 --oneline
cat ~/.git-credentials   # should contain bitbucket.org line
```

Repeat `git remote set-url` + `credential.helper store` + one `git pull` for each clone under `/var/www/`.

**Option B — App password in `.env`** (no interactive prompt; good for automation):

```bash
nano /var/www/ihute-frontend-dev/.env
```

```env
BITBUCKET_GIT_USER=your_bitbucket_username
BITBUCKET_APP_PASSWORD=your_app_password
```

Create the app password: **Bitbucket → Personal settings → App passwords** → permissions: **Repositories: Read**.

Test:

```bash
cd /var/www/ihute-frontend-dev
set -a && source .env && set +a
bash scripts/server-git-sync.sh master
```

**Option C — SSH deploy key**

```bash
bash /var/www/ihute-frontend/scripts/setup-bitbucket-deploy-key.sh
# Copy the printed .pub key → Bitbucket → Kimenyi/ihute-frontend → Repository settings → Access keys
GIT_SSH_COMMAND='ssh -i ~/.ssh/bitbucket_ihute_deploy -o IdentitiesOnly=yes' \
  git -C /var/www/ihute-frontend-dev fetch origin master
```

Repeat for `/var/www/ihute-frontend`, `ihute-frontend_beta`, and `grandma-ihute`.

### 4. First build and PM2

```bash
chmod +x /var/www/ihute-frontend/scripts/deploy-remote.sh

# Example: bootstrap dev
/var/www/ihute-frontend/scripts/deploy-remote.sh /var/www/ihute-frontend-dev master ihute-dev

# Or start all apps from ecosystem file (after each path has .env + build)
cd /var/www/ihute-frontend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # run the command it prints
```

Ensure nginx proxies each hostname to the correct `PORT` from that app’s `.env`.

### 5. SSH password for Bitbucket deploys

The pipeline connects with **SSH password** (`DEPLOY_PASS`), not a private key.

On the server, ensure password login is enabled for your deploy user (e.g. `root` or `deploy`):

```bash
# /etc/ssh/sshd_config — then: sudo systemctl reload sshd
PasswordAuthentication yes
```

Use a **dedicated deploy user** with sudo only where needed — avoid reusing your personal root password in CI if possible.

## Bitbucket configuration

### Repository variables

**Repository settings → Pipelines → Repository variables**

| Variable | Secured | Example |
|----------|---------|---------|
| `DEPLOY_HOST` | No | Server IP or hostname |
| `DEPLOY_USER` | No | `root` or `deploy` |
| `DEPLOY_PASS` | **Yes** | SSH password for `DEPLOY_USER` |

Remove `SSH_PRIVATE_KEY` if you added it earlier — it is no longer used.

Host keys are fetched automatically during deploy (`ssh-keyscan`). You do **not** need Bitbucket SSH keys / known hosts for this setup.

### Deployment environments (optional)

Bitbucket tracks deployments for: `production`, `staging` (dev), `test` (beta), `grandma`. You can add approval gates per environment under **Deployments**.

## Pipeline behaviour

**Push to `master`** → CI runs, then **automatic deploy to DEV** (`/var/www/ihute-frontend-dev`, dev.ihute.rw).

**Other branches / PRs** → CI only (no deploy).

**Beta, grandma, production** → manual via custom pipelines below.

### Run pipeline → Custom

| Pipeline | When to use |
|----------|-------------|
| **`default`** or **`promote`** | CI + auto DEV; then optional manual promote to beta, grandma, or production |
| **`deploy`** | Dropdown: `ENVIRONMENT` defaults to **dev**; optional `DEPLOY_BRANCH` |
| **`deploy-dev`** / **`deploy-beta`** / **`deploy-grandma`** / **`deploy-production`** | One-click deploy to that environment |
| **`ci-only`** | Lint + typecheck + build only |

### Typical flow

1. Merge to **`master`** → dev.ihute.rw updates automatically.
2. Merge Grandma Search to **`GRANDMA`** → shop.ihute.rw updates automatically (pipeline asserts `app/api/grandma/search/route.ts` exists).
3. Java Search servlet must be on **`MAPUTO`** (auto-deploys the WAR named by `Ndumiwe.targetEnvironment`). `/Trading/grandma/search` must return JSON before shop Search can succeed.
4. To promote to beta / production frontend: **Run pipeline → Custom → `promote`**, then click the manual step you need.

### Deploy any branch to any environment

Use custom pipeline **`deploy`**:

- `ENVIRONMENT`: `dev` | `beta` | `grandma` | `production`
- `DEPLOY_BRANCH`: leave empty to use the pipeline branch, or set e.g. `master`
- `RUN_CI`: `true` to validate before deploy, `false` to deploy immediately

## Manual deploy on the server

```bash
/var/www/ihute-frontend/scripts/deploy-remote.sh /var/www/ihute-frontend master ihute-frontend
```

## Troubleshooting

- **Build fails in CI but works on server** — CI uses placeholder `NEXT_PUBLIC_*` values; fix any code that requires real URLs at build time, or add CI-specific variables in `bitbucket-pipelines.yml`.
- **`pm2: command not found`** — install PM2 globally on the server (`npm i -g pm2`).
- **Permission denied on git pull** — ensure the deploy user owns `/var/www/ihute-frontend*` or can write those directories.
- **SSH permission denied (pipeline → server)** — check `DEPLOY_USER` / `DEPLOY_PASS`, and that `PasswordAuthentication yes` is set in `sshd_config`.
- **`git@bitbucket.org: Permission denied (publickey)` on server** — add `BITBUCKET_GIT_USER` + `BITBUCKET_APP_PASSWORD` to that folder’s `.env`, or set up a deploy key (see §3b).
- **Deploy script not found** — first deploy must use a path that already has the repo; bootstrap with a manual `git pull` on the server once.
- **Grandma Search unavailable / 503** — Next.js cannot reach Java `GET {JAVA_BACKEND_BASE}/grandma/search` (wrong `JAVA_BACKEND_BASE`/`BACKEND_URL`, Tomcat down, or Trading WAR missing `GrandmaSearchServlet`). Confirm with `curl -sS "$JAVA_BACKEND_BASE/grandma/search?q=milk&limit=5"`. Search does **not** require Next.js `ONBOARDING_MYSQL_*`. GPS persist, Umuriro drafts, client suggestions, admin Grandma sellers/drafts, and EBM helpers still need MySQL as listed above. Public API `error` is a user-safe message; technical codes stay in server logs.
