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

eval_mysql_complete() {
  mysql_complete=0
  mysql_source=""
  local prefix h u d url user
  for prefix in ONBOARDING_MYSQL EBM_MYSQL FORGOT_PASSWORD_MYSQL SUPPLIER_STOCK_MYSQL GQ_MYSQL MYSQL; do
    h="$(printenv "${prefix}_HOST" 2>/dev/null || true)"
    u="$(printenv "${prefix}_USER" 2>/dev/null || true)"
    d="$(printenv "${prefix}_DATABASE" 2>/dev/null || true)"
    if [[ -n "${h// }" && -n "${u// }" && -n "${d// }" ]]; then
      mysql_complete=1
      mysql_source="${prefix}_*"
      return
    fi
  done
  url="$(printenv DB_URL 2>/dev/null || true)"
  user="$(printenv DB_USER 2>/dev/null || true)"
  if [[ -n "${url// }" && -n "${user// }" && -n "${DB_PASS+x}" ]]; then
    mysql_complete=1
    mysql_source="DB_URL"
  fi
}

log_mysql_presence() {
  log "ONBOARDING_MYSQL_HOST=$(mysql_field "${ONBOARDING_MYSQL_HOST:-}") USER=$(mysql_field "${ONBOARDING_MYSQL_USER:-}") DATABASE=$(mysql_field "${ONBOARDING_MYSQL_DATABASE:-}") PORT=$(mysql_field "${ONBOARDING_MYSQL_PORT:-}") PASSWORD=$(printenv ONBOARDING_MYSQL_PASSWORD >/dev/null 2>&1 && printf present || printf missing)"
  log "GQ_MYSQL_HOST=$(mysql_field "${GQ_MYSQL_HOST:-}") USER=$(mysql_field "${GQ_MYSQL_USER:-}") DATABASE=$(mysql_field "${GQ_MYSQL_DATABASE:-}")"
  log "DB_URL=$(mysql_field "${DB_URL:-}") DB_USER=$(mysql_field "${DB_USER:-}") DB_PASS=$(printenv DB_PASS >/dev/null 2>&1 && printf present || printf missing)"
}

# Copy allowlisted MySQL keys from Java Tomcat env if Next.js .env is incomplete.
# Never eval the file. Never print values. Never write secrets into git.
# Skip keys already set so we do not add a second namespace on top of a complete one.
import_allowlisted_mysql_from_file() {
  local file="$1"
  local line key val current
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line// }" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*export[[:space:]]+ ]]; then
      line="${line#*export}"
      line="${line#"${line%%[![:space:]]*}"}"
    fi
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    case "$key" in
      DB_URL|DB_USER|DB_PASS|GQ_MYSQL_HOST|GQ_MYSQL_USER|GQ_MYSQL_PASSWORD|GQ_MYSQL_DATABASE|GQ_MYSQL_PORT|MYSQL_HOST|MYSQL_USER|MYSQL_PASSWORD|MYSQL_DATABASE|MYSQL_PORT|ONBOARDING_MYSQL_HOST|ONBOARDING_MYSQL_USER|ONBOARDING_MYSQL_PASSWORD|ONBOARDING_MYSQL_DATABASE|ONBOARDING_MYSQL_PORT|EBM_MYSQL_HOST|EBM_MYSQL_USER|EBM_MYSQL_PASSWORD|EBM_MYSQL_DATABASE|EBM_MYSQL_PORT|FORGOT_PASSWORD_MYSQL_HOST|FORGOT_PASSWORD_MYSQL_USER|FORGOT_PASSWORD_MYSQL_PASSWORD|FORGOT_PASSWORD_MYSQL_DATABASE|FORGOT_PASSWORD_MYSQL_PORT|SUPPLIER_STOCK_MYSQL_HOST|SUPPLIER_STOCK_MYSQL_USER|SUPPLIER_STOCK_MYSQL_PASSWORD|SUPPLIER_STOCK_MYSQL_DATABASE|SUPPLIER_STOCK_MYSQL_PORT) ;;
      *) continue ;;
    esac
    current="$(printenv "$key" 2>/dev/null || true)"
    if [[ -n "${current}" ]]; then
      continue
    fi
    val="${line#*=}"
    val="${val#"${val%%[![:space:]]*}"}"
    if [[ "$val" =~ ^\".*\"$ ]]; then
      val="${val:1:${#val}-2}"
    elif [[ "$val" =~ ^\'.*\'$ ]]; then
      val="${val:1:${#val}-2}"
    fi
    export "${key}=${val}"
  done < "$file"
}

try_reuse_tomcat_mysql() {
  local f="${TOMCAT_ENV_FILE:-/opt/tomcat10/.env}"
  if [[ "$mysql_complete" -eq 1 ]]; then
    return
  fi
  if [[ ! -f "$f" ]]; then
    log "Tomcat env file not found; cannot auto-reuse Java MySQL keys (Next.js cannot read Ndumiwe.hisha)"
    return
  fi
  log "Next.js MySQL incomplete; importing allowlisted keys from Java Tomcat env (presence only, values not printed)"
  import_allowlisted_mysql_from_file "$f"
  eval_mysql_complete
  log_mysql_presence
  if [[ "$mysql_complete" -eq 1 ]]; then
    log "MySQL config complete after Tomcat reuse via ${mysql_source} (schema name not printed; passed to PM2 --update-env)"
  else
    log "Tomcat env file present but allowlisted MySQL keys still incomplete (Java may keep credentials in encrypted Ndumiwe.hisha)"
  fi
}

log_mysql_presence
eval_mysql_complete
if [[ "$mysql_complete" -eq 1 ]]; then
  log "MySQL config complete via ${mysql_source} (schema name not printed)"
fi
if [[ "$mysql_complete" -eq 0 ]]; then
  log "WARNING: Next.js clone .env has no complete MySQL namespace yet."
  log "  Will try Java Tomcat env reuse immediately before PM2 restart."
  log "  Git pull does not update .env. If Tomcat reuse fails, add ONE complete existing namespace to $DEPLOY_PATH/.env:"
  log "  ONBOARDING_MYSQL_* or GQ_MYSQL_* or MYSQL_* or Tomcat DB_URL+DB_USER+DB_PASS"
  log "  HOST+USER+DATABASE required. Same schema as Java deployment-hint (do not guess the name)."
  log "  Do not copy .env.example placeholders. Do not create a second database."
  log "  Then: pm2 restart $PM2_APP_NAME --update-env"
fi

log "Installing dependencies (include devDependencies for next build)…"
# .env may set NODE_ENV=production — must not skip devDeps needed by next build.
unset NODE_ENV
npm ci --include=dev

log "Building Next.js…"
npm run build

export NODE_ENV=production

try_reuse_tomcat_mysql
if [[ "$mysql_complete" -eq 0 ]]; then
  log "WARNING: Grandma Search/Near Me will fail (MySQL not configured for this Next.js process)."
fi

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
