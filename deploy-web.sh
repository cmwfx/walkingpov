#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/var/www/candidfan"
REPO_URL="${CANDIDFAN_REPO_URL:?CANDIDFAN_REPO_URL is required}"
BRANCH="${BRANCH:-main}"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

command -v pm2 >/dev/null 2>&1 || npm install --global pm2
mkdir -p "$APP_ROOT"
if [ ! -d "$APP_ROOT/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_ROOT"
else
  git -C "$APP_ROOT" fetch origin "$BRANCH"
  git -C "$APP_ROOT" checkout "$BRANCH"
  git -C "$APP_ROOT" reset --hard "origin/$BRANCH"
fi

test -f "$APP_ROOT/server/.env"
cd "$APP_ROOT/server"
npm ci
npm run build
mkdir -p logs

cd "$APP_ROOT"
npm ci
npm run build

install -m 0644 "$APP_ROOT/nginx.conf" /etc/nginx/sites-available/candidfan
ln -sfn /etc/nginx/sites-available/candidfan /etc/nginx/sites-enabled/candidfan
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx

pm2 startOrRestart "$APP_ROOT/ecosystem.config.cjs" --update-env
pm2 save

if ! certbot certificates 2>/dev/null | grep -q 'candidfan.com'; then
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email \
    -d candidfan.com -d www.candidfan.com
fi
systemctl reload nginx
pm2 status
