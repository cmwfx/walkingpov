#!/usr/bin/env bash
set -euo pipefail

# Run this on the storage VPS only after a RunPod processor key has been
# created. It does not start a processor or change the local worker.
PROCESSOR_USER="${PROCESSOR_USER:-candidfan-processor}"
PROCESSOR_SSH_PUBLIC_KEY="${PROCESSOR_SSH_PUBLIC_KEY:?PROCESSOR_SSH_PUBLIC_KEY is required}"
MEDIA_ROOT="${MEDIA_ROOT:-/srv/candidfan-media}"

id -u "$PROCESSOR_USER" >/dev/null 2>&1 || useradd --system --home-dir "/var/lib/$PROCESSOR_USER" --create-home --shell /usr/sbin/nologin "$PROCESSOR_USER"
install -d -m 0700 -o "$PROCESSOR_USER" -g "$PROCESSOR_USER" "/var/lib/$PROCESSOR_USER/.ssh"
printf '%s\n' "$PROCESSOR_SSH_PUBLIC_KEY" > "/var/lib/$PROCESSOR_USER/.ssh/authorized_keys"
chown "$PROCESSOR_USER":"$PROCESSOR_USER" "/var/lib/$PROCESSOR_USER/.ssh/authorized_keys"
chmod 0600 "/var/lib/$PROCESSOR_USER/.ssh/authorized_keys"

setfacl -m u:"$PROCESSOR_USER":--x /root
setfacl -R -m u:"$PROCESSOR_USER":rX /root/videos
find /root/videos -type d -exec setfacl -m d:u:"$PROCESSOR_USER":rX {} +

setfacl -R -m u:"$PROCESSOR_USER":rwx "$MEDIA_ROOT"
find "$MEDIA_ROOT" -type d -exec setfacl -m d:u:"$PROCESSOR_USER":rwx {} +

cat > "/etc/ssh/sshd_config.d/candidfan-processor.conf" <<EOF
Match User $PROCESSOR_USER
    ChrootDirectory /
    ForceCommand internal-sftp
    AllowTcpForwarding no
    AllowAgentForwarding no
    PermitTunnel no
    X11Forwarding no
EOF

sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd
echo "SFTP access configured for $PROCESSOR_USER"
