#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/candidfan-runpod}"
REPO_URL="${CANDIDFAN_REPO_URL:?CANDIDFAN_REPO_URL is required}"
BRANCH="${BRANCH:-main}"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git ffmpeg openssh-client
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

if [ ! -d "$APP_ROOT/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_ROOT"
else
  git -C "$APP_ROOT" fetch origin "$BRANCH"
  git -C "$APP_ROOT" checkout "$BRANCH"
  git -C "$APP_ROOT" reset --hard "origin/$BRANCH"
fi

cd "$APP_ROOT/runpod-processor"
npm ci
test -f /etc/candidfan/runpod-processor.env
set -a
. /etc/candidfan/runpod-processor.env
set +a
exec node processor.mjs
