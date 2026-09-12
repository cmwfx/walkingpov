#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo 'website-bootstrap-requires-root' >&2
  exit 1
fi

repo_dir="${REPO_DIR:-/opt/candidfan-source}"
branch="${REPO_BRANCH:-candidfan-migration}"
repo_url="${REPO_URL:-https://github.com/cmwfx/walkingpov.git}"
release_id="${RELEASE_ID:-}"
certbot_email="${CERTBOT_EMAIL:?CERTBOT_EMAIL is required}"

command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }
command -v nginx >/dev/null || { apt-get update -qq && apt-get install -y -qq nginx; }
command -v certbot >/dev/null || { apt-get update -qq && apt-get install -y -qq certbot; }
command -v node >/dev/null && command -v npm >/dev/null || { apt-get update -qq && apt-get install -y -qq nodejs npm; }
id -u candidfan >/dev/null 2>&1 || useradd --system --home-dir /var/www/candidfan --shell /usr/sbin/nologin candidfan
chown root:candidfan /etc/candidfan/api.env
chmod 0640 /etc/candidfan/api.env

install -d -m 0755 -o candidfan -g candidfan /var/www/candidfan /var/www/candidfan/releases
install -d -m 0750 -o candidfan -g candidfan /var/lib/candidfan
install -d -m 0750 /etc/candidfan
if [[ ! -s /etc/candidfan/frontend.env || ! -s /etc/candidfan/api.env ]]; then
  echo 'website-bootstrap-missing-environment' >&2
  exit 1
fi

if [[ ! -d "${repo_dir}/.git" ]]; then
  git clone --branch "${branch}" --single-branch "${repo_url}" "${repo_dir}"
else
  git -C "${repo_dir}" fetch --quiet origin "${branch}"
  git -C "${repo_dir}" checkout --quiet -B "${branch}" "origin/${branch}"
fi

release_id="${release_id:-$(git -C "${repo_dir}" rev-parse --short HEAD)}"
release_dir="/var/www/candidfan/releases/${release_id}"
if [[ -e "${release_dir}" ]]; then
  echo 'website-bootstrap-release-exists' >&2
  exit 1
fi
install -d -m 0755 "${release_dir}"
git -C "${repo_dir}" archive "${branch}" | tar -x -C "${release_dir}"

set -a
. /etc/candidfan/frontend.env
set +a
cd "${release_dir}"
npm ci --ignore-scripts --no-audit --no-fund
npm run build
rm -rf node_modules

cd server
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm prune --omit=dev --no-audit --no-fund
cd ..

chown -R candidfan:candidfan "${release_dir}"
install -m 0644 "${release_dir}/deploy/candidfan-api.service" /etc/systemd/system/candidfan-api.service
install -m 0644 "${release_dir}/deploy/candidfan-email-worker.service" /etc/systemd/system/candidfan-email-worker.service
install -m 0644 "${release_dir}/deploy/candidfan-telegram-worker.service" /etc/systemd/system/candidfan-telegram-worker.service
install -m 0644 "${release_dir}/nginx.conf" /etc/nginx/sites-available/candidfan
ln -sfn /etc/nginx/sites-available/candidfan /etc/nginx/sites-enabled/candidfan
ln -sfn "${release_dir}" /var/www/candidfan/current

if [[ ! -f /etc/letsencrypt/live/candidfan.com/fullchain.pem ]]; then
  systemctl stop nginx 2>/dev/null || true
  certbot certonly --standalone --non-interactive --agree-tos --email "${certbot_email}" -d candidfan.com -d www.candidfan.com
fi

nginx -t
systemctl daemon-reload
systemctl enable --now nginx candidfan-api.service candidfan-email-worker.service candidfan-telegram-worker.service
systemctl restart candidfan-api.service candidfan-email-worker.service candidfan-telegram-worker.service

echo "website-bootstrap-complete ${release_id}"
