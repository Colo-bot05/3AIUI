#!/bin/sh
set -e

# Compose DATABASE_URL from the separate DB_* secrets App Runner injects.
# Leaves DATABASE_URL alone if it was supplied directly.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_HOST:-}" ]; then
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

exec "$@"
