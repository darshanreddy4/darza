#!/usr/bin/env bash
# Saves the database (and, when uploads are kept on this server, the uploaded pictures) into ./backups.
# Run it from this folder, by hand or from cron:   0 2 * * * cd /path/to/deploy && ./backup.sh
# Keep copies off this server too (another machine or a bucket); a backup on the same disk is not a backup.
set -euo pipefail
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups

docker compose exec -T db pg_dump -U "${POSTGRES_USER:-shop}" -Fc "${POSTGRES_DB:-shop}" > "backups/db-$STAMP.dump"
echo "Database saved: backups/db-$STAMP.dump"

if [ "${STORAGE_DRIVER:-local}" = "local" ]; then
  docker compose exec -T api tar -C /app -cf - uploads > "backups/uploads-$STAMP.tar"
  echo "Uploads saved: backups/uploads-$STAMP.tar"
fi

find backups -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar' \) -mtime +"$KEEP_DAYS" -delete
