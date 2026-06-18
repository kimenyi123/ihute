#!/usr/bin/env bash
# One-time server bootstrap for ihute-frontend CI/CD.
# Run on ubuntu-s-8vcpu-16gb-ams3-01 as a user with write access to /var/www.
#
# Usage:
#   export BITBUCKET_REPO_SSH=git@bitbucket.org:YOUR_WORKSPACE/ihute-frontend.git
#   bash scripts/server-bootstrap.sh
#
set -euo pipefail

REPO_SSH="${BITBUCKET_REPO_SSH:?Set BITBUCKET_REPO_SSH (git@bitbucket.org:workspace/ihute-frontend.git)}"
WWW_ROOT="${WWW_ROOT:-/var/www}"

declare -A CHECKOUTS=(
  ["ihute-frontend"]="master"
  ["ihute-frontend-dev"]="master"
  ["ihute-frontend_beta"]="beta"
  ["grandma-ihute"]="GRANDMA"
)

log() { printf '[bootstrap] %s\n' "$*"; }

for dir in "${!CHECKOUTS[@]}"; do
  branch="${CHECKOUTS[$dir]}"
  path="$WWW_ROOT/$dir"
  if [[ -d "$path/.git" ]]; then
    log "Skip existing clone: $path"
    continue
  fi
  log "Cloning $REPO_SSH → $path (branch $branch)"
  git clone --branch "$branch" "$REPO_SSH" "$path" || {
    log "Branch $branch missing — cloning default branch; checkout manually"
    git clone "$REPO_SSH" "$path"
  }
done

deploy_script="$WWW_ROOT/ihute-frontend/scripts/deploy-remote.sh"
if [[ -f "$deploy_script" ]]; then
  chmod +x "$deploy_script"
  log "Made executable: $deploy_script"
fi

log "Next steps:"
log "  1. Copy .env into each /var/www/* directory (see .env.dev.example)"
log "  2. Run first deploy: $deploy_script $WWW_ROOT/ihute-frontend-dev master ihute-dev"
log "  3. pm2 start $WWW_ROOT/ihute-frontend/ecosystem.config.cjs && pm2 save && pm2 startup"
log "  4. Configure Bitbucket variables: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PASS"
