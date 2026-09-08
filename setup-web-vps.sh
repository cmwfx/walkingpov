#!/usr/bin/env bash
set -euo pipefail

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git nginx
mkdir -p /var/www/candidfan
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
echo "Web VPS base setup complete. Add /var/www/candidfan/server/.env, then run deploy-web.sh."
