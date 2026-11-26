#!/usr/bin/env bash
# Starts (or restarts) the stack on the server with a given image version.
# GitHub Actions builds the image on the server and calls this; you can too:
#   cd /opt/choicemi && ./deploy.sh              # keep the current image, apply config changes
#   cd /opt/choicemi && ./deploy.sh abc1234...   # run image choicemi-web:abc1234... (rollback)
#   cd /opt/choicemi && ./deploy.sh abc1234 def5678 ghi9012   # also run choicemi-restaurant:def5678 and choicemi-admin:ghi9012
# Older images stay on the server (newest 5 kept), so a rollback is instant.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -n "${1:-}" ]]; then
  docker image inspect "choicemi-web:${1}" >/dev/null
  sed -i "s#^IMAGE=.*#IMAGE=choicemi-web:${1}#" .env
fi

# the restaurant site's image: set when given, and always present so compose can start it
if [[ -n "${2:-}" ]]; then
  docker image inspect "choicemi-restaurant:${2}" >/dev/null
  grep -q '^RESTAURANT_IMAGE=' .env && sed -i "s#^RESTAURANT_IMAGE=.*#RESTAURANT_IMAGE=choicemi-restaurant:${2}#" .env || printf 'RESTAURANT_IMAGE=choicemi-restaurant:%s\n' "${2}" >> .env
fi

# the staff site's image, the same way
if [[ -n "${3:-}" ]]; then
  docker image inspect "choicemi-admin:${3}" >/dev/null
  grep -q '^ADMIN_IMAGE=' .env && sed -i "s#^ADMIN_IMAGE=.*#ADMIN_IMAGE=choicemi-admin:${3}#" .env || printf 'ADMIN_IMAGE=choicemi-admin:%s\n' "${3}" >> .env
fi

docker compose up -d --remove-orphans
docker compose ps

# keep the 5 newest images of ours, drop older ones and any dangling layers
for repo in choicemi-web choicemi-restaurant choicemi-admin; do
  docker images "$repo" --format '{{.CreatedAt}}|{{.ID}}' | sort -r | tail -n +6 | cut -d'|' -f2 | xargs -r docker rmi -f >/dev/null 2>&1 || true
done
docker image prune -f >/dev/null
