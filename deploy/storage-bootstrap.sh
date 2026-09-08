#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo 'storage-bootstrap-requires-root' >&2
  exit 1
fi

repo_dir="${REPO_DIR:-/opt/candidfan-source}"
branch="${REPO_BRANCH:-candidfan-migration}"
repo_url="${REPO_URL:-https://github.com/cmwfx/walkingpov.git}"
certbot_email="${CERTBOT_EMAIL:?CERTBOT_EMAIL is required}"

command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }
command -v nginx >/dev/null || { apt-get update -qq && apt-get install -y -qq nginx; }
command -v certbot >/dev/null || { apt-get update -qq && apt-get install -y -qq certbot; }
command -v node >/dev/null && command -v npm >/dev/null || { apt-get update -qq && apt-get install -y -qq nodejs npm; }

if [[ ! -d "${repo_dir}/.git" ]]; then
  git clone --branch "${branch}" --single-branch "${repo_url}" "${repo_dir}"
else
  git -C "${repo_dir}" fetch --quiet origin "${branch}"
  git -C "${repo_dir}" checkout --quiet -B "${branch}" "origin/${branch}"
fi

id -u candidfan-media >/dev/null 2>&1 || useradd --system --home-dir /opt/candidfan-media --shell /usr/sbin/nologin candidfan-media
install -d -m 0755 /opt/candidfan-media /opt/candidfan-importer
install -d -m 0755 /srv/candidfan
install -d -m 0750 -o root -g www-data /srv/candidfan/media /srv/candidfan/thumbnails
install -d -m 0750 -o root -g root /srv/candidfan/intake
install -d -m 0750 -o root -g candidfan-media /srv/candidfan/state
install -m 0644 "${repo_dir}/media/placeholder.jpg" /srv/candidfan/thumbnails/placeholder.jpg

if [[ ! -s /etc/candidfan/media.env ]]; then
  media_signing_secret="$(openssl rand -hex 32)"
  install -d -m 0750 /etc/candidfan
  umask 027
  cat > /etc/candidfan/media.env <<EOF
NODE_ENV=production
PORT=3100
MEDIA_ROOT=/srv/candidfan/media
MEDIA_SIGNING_SECRET=${media_signing_secret}
EOF
  chown root:candidfan-media /etc/candidfan/media.env
  chmod 0640 /etc/candidfan/media.env
else
  media_signing_secret="$(sed -n 's/^MEDIA_SIGNING_SECRET=//p' /etc/candidfan/media.env)"
fi

if [[ -z "${media_signing_secret}" ]]; then
  echo 'storage-bootstrap-missing-media-secret' >&2
  exit 1
fi

if [[ ! -s /etc/candidfan/importer.env ]]; then
  importer_token="$(openssl rand -hex 32)"
  umask 077
  cat > /etc/candidfan/importer.env <<EOF
NODE_ENV=production
WEBSITE_INTERNAL_URL=https://candidfan.com
IMPORTER_TOKEN=${importer_token}
IMPORT_SOURCE_KIND=originals
ORIGINALS_DIR=/root/videos
INTAKE_DIR=/srv/candidfan/intake
MEDIA_DIR=/srv/candidfan/media
THUMBNAIL_DIR=/srv/candidfan/thumbnails
EOF
  chown root:root /etc/candidfan/importer.env
  chmod 0600 /etc/candidfan/importer.env
fi

cd "${repo_dir}/media"
npm ci --ignore-scripts --no-audit --no-fund
npm run build
rm -rf /opt/candidfan-media/dist
cp -a dist /opt/candidfan-media/dist

cd "${repo_dir}/importer"
npm ci --ignore-scripts --no-audit --no-fund
npm run build
rm -rf /opt/candidfan-importer/dist
cp -a dist /opt/candidfan-importer/dist

install -m 0644 "${repo_dir}/deploy/candidfan-media-verifier.service" /etc/systemd/system/candidfan-media-verifier.service
install -m 0644 "${repo_dir}/deploy/candidfan-importer.service" /etc/systemd/system/candidfan-importer.service
install -m 0644 "${repo_dir}/media/nginx.conf" /etc/nginx/sites-available/candidfan-media
ln -sfn /etc/nginx/sites-available/candidfan-media /etc/nginx/sites-enabled/candidfan-media

if [[ ! -f /etc/letsencrypt/live/media.candidfan.com/fullchain.pem ]]; then
  systemctl stop nginx 2>/dev/null || true
  certbot certonly --standalone --non-interactive --agree-tos --email "${certbot_email}" -d media.candidfan.com
fi

nginx -t
systemctl daemon-reload
systemctl enable --now nginx candidfan-media-verifier.service
systemctl enable candidfan-importer.service
systemctl restart candidfan-media-verifier.service

echo 'storage-bootstrap-complete'
