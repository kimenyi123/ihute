#!/usr/bin/env bash
# Resolve deploy target from ENVIRONMENT variable (used by Bitbucket promote pipeline).
set -euo pipefail

ENVIRONMENT="${1:?Usage: pipeline-resolve-target.sh <dev|beta|production|grandma>}"

case "$ENVIRONMENT" in
  production)
    echo "DEPLOY_PATH=/var/www/ihute-frontend"
    echo "PM2_APP_NAME=ihute-frontend"
    echo "DEPLOYMENT_NAME=production"
    ;;
  dev)
    echo "DEPLOY_PATH=/var/www/ihute-frontend-dev"
    echo "PM2_APP_NAME=ihute-dev"
    echo "DEPLOYMENT_NAME=staging"
    ;;
  beta)
    echo "DEPLOY_PATH=/var/www/ihute-frontend_beta"
    echo "PM2_APP_NAME=ihute-beta"
    echo "DEPLOYMENT_NAME=test"
    ;;
  grandma)
    echo "DEPLOY_PATH=/var/www/grandma-ihute"
    echo "PM2_APP_NAME=ihute-grandma"
    echo "DEPLOYMENT_NAME=grandma"
    ;;
  *)
    echo "Unknown ENVIRONMENT: $ENVIRONMENT (use dev, beta, production, grandma)" >&2
    exit 1
    ;;
esac
