#!/bin/sh
set -e

# Applies any pending Prisma migrations to the SQLite file on the mounted
# volume. Safe to run on every container start (no-op if already current).
npx prisma migrate deploy

exec "$@"
