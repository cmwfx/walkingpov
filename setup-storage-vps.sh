#!/usr/bin/env bash
set -euo pipefail

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git nginx ffmpeg acl
mkdir -p /etc/candidfan /srv/candidfan-media
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
echo "Storage VPS base setup complete. Add /etc/candidfan/storage-worker.env, then run deploy-storage.sh."
