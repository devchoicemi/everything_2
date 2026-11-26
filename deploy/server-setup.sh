#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 UpCloud server. Run as root:
#   bash server-setup.sh
#
# What it does: updates the system, installs Docker, creates a non-root "deploy"
# user (using the SSH key you already added to the server), turns on the
# firewall, fail2ban and automatic security updates, adds swap, and locks SSH
# down to keys only.
#
# SAFE ORDER: it does NOT disable root login until you pass --lock-root, so you
# can first confirm "ssh deploy@SERVER" works in a second window.

set -euo pipefail

LOCK_ROOT=0
[[ "${1:-}" == "--lock-root" ]] && LOCK_ROOT=1

if [[ $EUID -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

echo "==> Updating system"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> Creating the deploy user"
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
if [[ -s /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
else
  echo "WARNING: /root/.ssh/authorized_keys is empty. Add your public key to /home/deploy/.ssh/authorized_keys by hand." >&2
fi

echo "==> App folder"
install -d -m 755 -o deploy -g deploy /opt/choicemi /opt/choicemi/backups

echo "==> Swap (2 GB) so builds and spikes do not run the server out of memory"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Firewall (UFW): SSH, HTTP, HTTPS only"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> fail2ban (blocks repeated SSH password guessing)"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "==> Automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

echo "==> SSH hardening"
cat > /etc/ssh/sshd_config.d/99-choicemi.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
if [[ $LOCK_ROOT -eq 1 ]]; then
  echo "PermitRootLogin no" >> /etc/ssh/sshd_config.d/99-choicemi.conf
  echo "    root login disabled"
else
  echo "    root login still allowed (re-run with --lock-root after testing the deploy user)"
fi
sshd -t
systemctl reload ssh

echo
echo "Done."
echo "Next: open a SECOND terminal and check you can log in:  ssh deploy@<server-ip>"
echo "Then run again with --lock-root to disable root login."
