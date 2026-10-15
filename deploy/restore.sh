#!/usr/bin/env bash
# Puts a backup made by backup.sh back:   ./restore.sh backups/db-20261020-020000.dump
# This REPLACES everything in the database, so it asks first. Try it on a spare server now and then, to know it works.
set -euo pipefail
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
FILE="${1:?Usage: ./restore.sh backups/db-<time>.dump}"
[ -f "$FILE" ] || { echo "No such file: $FILE"; exit 1; }
read -r -p "Replace the whole database with $FILE? Type YES to continue: " answer
[ "$answer" = "YES" ] || { echo "Cancelled."; exit 1; }
docker compose stop api web
docker compose exec -T db pg_restore -U "${POSTGRES_USER:-shop}" -d "${POSTGRES_DB:-shop}" --clean --if-exists --no-owner < "$FILE"
docker compose start api web
echo "Restored."
