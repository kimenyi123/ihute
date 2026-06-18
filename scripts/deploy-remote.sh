#!/usr/bin/env bash
# Run on the Ubuntu server via Bitbucket Pipelines (SSH) or manually.
#
# Usage:
#   ./scripts/deploy-remote.sh /var/www/ihute-frontend master ihute-frontend
#   ./scripts/deploy-remote.sh /var/www/ihute-frontend-dev develop ihute-frontend-dev
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

if [[ -f .env ]]; then
  log "Using existing .env in $DEPLOY_PATH"
else
  log "WARNING: no .env in $DEPLOY_PATH — copy from .env.dev.example / server secrets before first run"
fi

export NODE_ENV=production

log "Installing dependencies…"
npm ci

log "Building Next.js…"
npm run build

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
