#!/usr/bin/env bash
# Run on the Ubuntu server via Bitbucket Pipelines (SSH) or manually.
#
# Usage:
#   ./scripts/deploy-remote.sh /var/www/ihute-frontend master ihute-frontend
#   ./scripts/deploy-remote.sh /var/www/ihute-frontend-dev master ihute-dev
#
set -euo pipefail

DEPLOY_PATH="${1:?Usage: deploy-remote.sh <deploy-path> <branch> [pm2-app-name]}"
DEPLOY_BRANCH="${2:?Usage: deploy-remote.sh <deploy-path> <branch> [pm2-app-name]}"
PM2_APP_NAME="${3:-$(basename "$DEPLOY_PATH")}"
ECOSYSTEM_FILE="${ECOSYSTEM_FILE:-$DEPLOY_PATH/ecosystem.config.cjs}"

log() { printf '[deploy] %s\n' "$*"; }

if [[ ! -d "$DEPLOY_PATH" ]]; then
  log "ERROR: deploy path does not exist: $DEPLOY_PATH"
  exit 1
fi

cd "$DEPLOY_PATH"

if [[ ! -d .git ]]; then
  log "ERROR: $DEPLOY_PATH is not a git repository"
  exit 1
fi

log "Deploying branch $DEPLOY_BRANCH → $DEPLOY_PATH (pm2: $PM2_APP_NAME)"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  log "Loaded .env"
fi

# shellcheck disable=SC1091
source "$(dirname "$0")/server-git-sync.sh"
server_git_sync "$DEPLOY_BRANCH"

# Re-exec after git pull so we run the updated script (bash reads the file at start).
if [[ -z "${DEPLOY_REMOTE_REEXEC:-}" ]]; then
  export DEPLOY_REMOTE_REEXEC=1
  exec bash "$DEPLOY_PATH/scripts/deploy-remote.sh" "$@"
fi

if [[ -f .env ]]; then
  log "Using existing .env in $DEPLOY_PATH"
else
  log "WARNING: no .env in $DEPLOY_PATH — copy from .env.dev.example / server secrets before first run"
fi

# Presence-only MySQL check (never prints values). Grandma Search needs HOST+USER+DATABASE.
mysql_field() {
  local v="${1:-}"
  if [[ -n "${v// }" ]]; then printf 'present'; else printf 'missing'; fi
}
log "ONBOARDING_MYSQL_HOST=$(mysql_field "${ONBOARDING_MYSQL_HOST:-}") USER=$(mysql_field "${ONBOARDING_MYSQL_USER:-}") DATABASE=$(mysql_field "${ONBOARDING_MYSQL_DATABASE:-}") PORT=$(mysql_field "${ONBOARDING_MYSQL_PORT:-}") PASSWORD=$(printenv ONBOARDING_MYSQL_PASSWORD >/dev/null 2>&1 && printf present || printf missing)"
mysql_complete=0
for prefix in ONBOARDING_MYSQL EBM_MYSQL FORGOT_PASSWORD_MYSQL SUPPLIER_STOCK_MYSQL MYSQL; do
  h="$(printenv "${prefix}_HOST" 2>/dev/null || true)"
  u="$(printenv "${prefix}_USER" 2>/dev/null || true)"
  d="$(printenv "${prefix}_DATABASE" 2>/dev/null || true)"
  if [[ -n "${h// }" && -n "${u// }" && -n "${d// }" ]]; then
    mysql_complete=1
    log "MySQL config complete via ${prefix}_* (schema name not printed)"
    break
  fi
done
if [[ "$mysql_complete" -eq 0 ]]; then
  log "WARNING: Grandma Search will return MYSQL_NOT_CONFIGURED."
  log "  Add ONBOARDING_MYSQL_HOST/USER/PASSWORD/DATABASE to $DEPLOY_PATH/.env"
  log "  Use the SAME schema as Java: GET {JAVA_BACKEND_BASE}/Kaos/deployment-hint → database"
  log "  Do not copy .env.example placeholders. Do not overwrite unrelated keys."
  log "  Then: pm2 restart $PM2_APP_NAME --update-env"
fi

log "Installing dependencies (include devDependencies for next build)…"
# .env may set NODE_ENV=production — must not skip devDeps needed by next build.
unset NODE_ENV
npm ci --include=dev

log "Building Next.js…"
npm run build

export NODE_ENV=production

log "Restarting PM2 process: $PM2_APP_NAME"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  if [[ -f "$ECOSYSTEM_FILE" ]]; then
    pm2 start "$ECOSYSTEM_FILE" --only "$PM2_APP_NAME"
  else
    pm2 start npm --name "$PM2_APP_NAME" --cwd "$DEPLOY_PATH" -- start
  fi
fi

pm2 save

log "Done. Active revision:"
git rev-parse --short HEAD
