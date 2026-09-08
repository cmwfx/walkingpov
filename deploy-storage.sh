#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/candidfan"
REPO_URL="${CANDIDFAN_REPO_URL:?CANDIDFAN_REPO_URL is required}"
BRANCH="${BRANCH:-main}"
WORKER_USER="candidfan-worker"
MEDIA_ROOT="/srv/candidfan-media"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git nginx ffmpeg acl certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

id -u "$WORKER_USER" >/dev/null 2>&1 || useradd --system --home-dir /var/lib/candidfan-worker --create-home --shell /usr/sbin/nologin "$WORKER_USER"
mkdir -p "$APP_ROOT" "$MEDIA_ROOT"/sources "$MEDIA_ROOT"/work "$MEDIA_ROOT"/published/full "$MEDIA_ROOT"/published/previews "$MEDIA_ROOT"/published/thumbnails
chown -R "$WORKER_USER":"$WORKER_USER" "$MEDIA_ROOT"
setfacl -m u:"$WORKER_USER":--x /root
setfacl -R -m u:"$WORKER_USER":rX /root/videos
setfacl -m d:u:"$WORKER_USER":rX /root/videos

if [ ! -d "$APP_ROOT/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_ROOT"
else
  git -C "$APP_ROOT" fetch origin "$BRANCH"
  git -C "$APP_ROOT" checkout "$BRANCH"
  git -C "$APP_ROOT" reset --hard "origin/$BRANCH"
fi

test -f /etc/candidfan/storage-worker.env
set -a
. /etc/candidfan/storage-worker.env
set +a
test -n "${MEDIA_SIGNING_SECRET:-}"

sed "s|MEDIA_SIGNING_SECRET|$MEDIA_SIGNING_SECRET|g" "$APP_ROOT/storage-nginx.conf" > /etc/nginx/sites-available/candidfan-media
ln -sfn /etc/nginx/sites-available/candidfan-media /etc/nginx/sites-enabled/candidfan-media
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx

cat > /etc/systemd/system/candidfan-storage-worker.service <<'UNIT'
[Unit]
Description=CandidFan storage importer
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=candidfan-worker
WorkingDirectory=/opt/candidfan/storage-worker
EnvironmentFile=/etc/candidfan/storage-worker.env
ExecStart=/usr/bin/node /opt/candidfan/storage-worker/worker.mjs
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=false
ReadWritePaths=/srv/candidfan-media

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now candidfan-storage-worker

if ! certbot certificates 2>/dev/null | grep -q 'media.candidfan.com'; then
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email \
    -d media.candidfan.com
fi
systemctl reload nginx
systemctl --no-pager --full status candidfan-storage-worker
