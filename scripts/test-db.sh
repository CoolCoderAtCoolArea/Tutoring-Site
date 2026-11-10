#!/usr/bin/env bash
# Runs the database security tests (Row Level Security, booking rules, etc).
#
#   npm run test:db
#
# It starts a temporary PostgreSQL, loads supabase/migrations + seed, runs
# tests/db/*.test.ts, then throws the database away. Needs PostgreSQL 15+
# installed (initdb/pg_ctl on your PATH, or in /usr/lib/postgresql/*/bin).
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")"
if [ ! -x "$PGBIN/initdb" ]; then echo "PostgreSQL (initdb) not found. Install PostgreSQL 15+."; exit 1; fi

TMP="$(mktemp -d)"
PORT="${TEST_DB_PORT:-55432}"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then   # PostgreSQL refuses to run as root
  id pgtest >/dev/null 2>&1 || useradd -M -s /bin/false pgtest
  chown -R pgtest "$TMP"; RUN_AS="runuser -u pgtest --"
fi
cleanup() { $RUN_AS "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

$RUN_AS "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
$RUN_AS "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=localhost" -l "$TMP/log" start -w >/dev/null

export DATABASE_URL="postgresql://postgres@localhost:$PORT/postgres"
PSQL="$PGBIN/psql -q -o /dev/null -v ON_ERROR_STOP=1 -h localhost -p $PORT -U postgres -d postgres"
$PSQL -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do $PSQL -f "$f"; done
$PSQL -f supabase/seed.sql
echo "✓ migrations and seed loaded"

npx vitest run --config vitest.db.config.mts "$@"
