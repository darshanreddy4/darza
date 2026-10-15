#!/bin/sh
set -e
# Applies any new database migrations before the API starts. Set RUN_MIGRATIONS=false to run them yourself.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  npx prisma migrate deploy
fi
exec "$@"
