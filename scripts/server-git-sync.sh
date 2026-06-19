#!/usr/bin/env bash
# Git fetch on the deploy server (Bitbucket auth).
# Called from deploy-remote.sh after .env is loaded.
#
# Auth (pick one):
#   1. HTTPS — BITBUCKET_GIT_USER + BITBUCKET_APP_PASSWORD in .env
#   2. SSH   — deploy key at ~/.ssh/bitbucket_ihute_deploy (or BITBUCKET_DEPLOY_KEY)
#   3. HTTPS remote + `git config credential.helper store` (one-time password prompt)
#
set -euo pipefail

server_git_sync() {
  local branch="${1:?branch required}"
  local origin_url
  origin_url="$(git remote get-url origin)"

  if [[ -n "${BITBUCKET_APP_PASSWORD:-}" ]]; then
    local user="${BITBUCKET_GIT_USER:-}"
    if [[ -z "$user" ]]; then
      echo "[git] ERROR: BITBUCKET_APP_PASSWORD is set but BITBUCKET_GIT_USER is missing in .env" >&2
      exit 1
    fi
    local repo_path
    repo_path="$(
      echo "$origin_url" | sed -E \
        's#^git@bitbucket\.org:##; s#^https://([^@]+@)?bitbucket\.org/##; s#\.git$##'
    )"
    local fetch_url="https://${user}:${BITBUCKET_APP_PASSWORD}@bitbucket.org/${repo_path}.git"
    echo "[git] Fetching $branch via HTTPS (app password)…"
    git fetch "$fetch_url" "$branch"
    git checkout "$branch" 2>/dev/null || git checkout -b "$branch"
    git reset --hard FETCH_HEAD
    return 0
  fi

  local deploy_key="${BITBUCKET_DEPLOY_KEY:-$HOME/.ssh/bitbucket_ihute_deploy}"
  if [[ -f "$deploy_key" ]]; then
    echo "[git] Fetching $branch via SSH deploy key ($deploy_key)…"
    GIT_SSH_COMMAND="ssh -i ${deploy_key} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
      git fetch origin "$branch"
    git checkout "$branch" 2>/dev/null || git checkout -b "$branch" --track "origin/$branch"
    git reset --hard "origin/$branch"
    return 0
  fi

  if [[ "$origin_url" =~ ^https:// ]]; then
    echo "[git] Fetching $branch via HTTPS origin (credential helper / cached login)…"
    git fetch origin "$branch"
    git checkout "$branch" 2>/dev/null || git checkout -b "$branch" --track "origin/$branch"
    git reset --hard "origin/$branch"
    return 0
  fi

  echo "[git] Fetching $branch via SSH origin…" >&2
  echo "[git] If this fails, switch to HTTPS: git remote set-url origin https://USER@bitbucket.org/Kimenyi/ihute-frontend.git" >&2
  echo "[git] Then: git config credential.helper store && git pull origin master" >&2
  git fetch origin "$branch"
  git checkout "$branch"
  git reset --hard "origin/$branch"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  server_git_sync "${1:?Usage: server-git-sync.sh <branch>}"
fi
