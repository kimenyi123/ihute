#!/usr/bin/env bash
# Prints a remote shell command for Bitbucket SSH deploy (runs on the Ubuntu server).
# Uses deploy-remote.sh when present; otherwise inline git pull + build + pm2.
set -euo pipefail

DEPLOY_PATH="${1:?deploy path}"
DEPLOY_BRANCH="${2:?branch}"
PM2_APP_NAME="${3:?pm2 app name}"

cat <<EOF
set -euo pipefail
DEPLOY_PATH='$DEPLOY_PATH'
DEPLOY_BRANCH='$DEPLOY_BRANCH'
PM2_APP_NAME='$PM2_APP_NAME'
SCRIPT="\$DEPLOY_PATH/scripts/deploy-remote.sh"
if [ -f "\$SCRIPT" ]; then
  bash "\$SCRIPT" "\$DEPLOY_PATH" "\$DEPLOY_BRANCH" "\$PM2_APP_NAME"
else
  echo "[deploy] deploy-remote.sh not found — inline pull/build/restart"
  cd "\$DEPLOY_PATH"
  git fetch origin "\$DEPLOY_BRANCH"
  git checkout "\$DEPLOY_BRANCH" 2>/dev/null || git checkout -b "\$DEPLOY_BRANCH" --track "origin/\$DEPLOY_BRANCH"
  git reset --hard "origin/\$DEPLOY_BRANCH"
  unset NODE_ENV
  npm ci --include=dev
  npm run build
  export NODE_ENV=production
  if pm2 describe "\$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "\$PM2_APP_NAME" --update-env
  else
    pm2 start npm --name "\$PM2_APP_NAME" --cwd "\$DEPLOY_PATH" -- start
  fi
  pm2 save
  git rev-parse --short HEAD
fi
EOF
