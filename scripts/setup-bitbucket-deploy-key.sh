#!/usr/bin/env bash
# One-time: create SSH deploy key for Bitbucket git pull on the server.
# Add the printed public key in Bitbucket → Repository settings → Access keys.
set -euo pipefail

KEY_PATH="${1:-$HOME/.ssh/bitbucket_ihute_deploy}"

if [[ -f "$KEY_PATH" ]]; then
  echo "Key already exists: $KEY_PATH"
else
  mkdir -p "$(dirname "$KEY_PATH")"
  chmod 700 "$(dirname "$KEY_PATH")"
  ssh-keygen -t ed25519 -C "ihute-server-deploy" -f "$KEY_PATH" -N ""
  echo "Created: $KEY_PATH"
fi

echo ""
echo "Add this public key to Bitbucket (Kimenyi/ihute-frontend → Repository settings → Access keys):"
echo ""
cat "${KEY_PATH}.pub"
echo ""
echo "Then test:"
echo "  GIT_SSH_COMMAND='ssh -i $KEY_PATH -o IdentitiesOnly=yes' git -C /var/www/ihute-frontend-dev fetch origin master"
