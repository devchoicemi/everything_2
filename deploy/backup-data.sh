#!/usr/bin/env bash
# Backs up the database (pg_dump) and the app's data volume to /opt/choicemi/backups
# and keeps the last 14 days. Run daily from cron (see web/docs/SERVER_SETUP.md).
# If DATABASE_URL points at a managed database, that service has its own backups
# and only the volume part applies.
set -euo pipefail

BACKUP_DIR=/opt/choicemi/backups
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
cd "$(dirname "$0")"

if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  docker compose exec -T db pg_dump -U choicemi -d choicemi --no-owner | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
  echo "Database backup written: $BACKUP_DIR/db-$STAMP.sql.gz"
fi

docker run --rm   -v choicemi_app_data:/data:ro   -v "$BACKUP_DIR":/backup   alpine tar czf "/backup/app-data-$STAMP.tar.gz" -C /data .

# Retention (see the Privacy Policy): security log 90 days; expired sessions, tokens, invitations and counters are dropped.
if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  docker compose exec -T db psql -U choicemi -d choicemi -q -c "
    delete from auth_events where created_at < now() - interval '90 days';
    delete from sessions where expires_at < now() - interval '30 days' or revoked_at < now() - interval '30 days';
    delete from email_tokens where expires_at < now() - interval '7 days';
    delete from invites where expires_at < now() - interval '30 days';
    delete from oidc_flows where expires_at < now() - interval '1 day';
    delete from rate_limits where expires_at < now();" </dev/null
  echo "Retention clean-up done"
fi

find "$BACKUP_DIR" \( -name 'app-data-*.tar.gz' -o -name 'db-*.sql.gz' \) -mtime +14 -delete
echo "Backup written: $BACKUP_DIR/app-data-$STAMP.tar.gz"
