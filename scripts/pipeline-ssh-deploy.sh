#!/usr/bin/env bash
# SSH to the deploy server using password auth (DEPLOY_PASS) from Bitbucket variables.
set -euo pipefail

REMOTE_CMD="${1:?Usage: pipeline-ssh-deploy.sh '<remote command>'}"

: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
: "${DEPLOY_PASS:?Set DEPLOY_PASS (secured repository variable)}"

if ! command -v sshpass >/dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sshpass openssh-client
fi

mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts 2>/dev/null || true

export SSHPASS="$DEPLOY_PASS"
sshpass -e ssh \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$HOME/.ssh/known_hosts" \
  "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "$REMOTE_CMD"
