#!/usr/bin/env bash
# Restores the prod dump as a NEW database named l2l_prod on the same cluster.
# Does NOT touch l2l (original prod) or l2l_dev.
# If l2l_prod already exists, this will refuse unless FORCE=1 is set.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DUMP_DIR="${SCRIPT_DIR}/dump/l2l"

if [ ! -d "${DUMP_DIR}" ]; then
  echo "ERROR: dump not found at ${DUMP_DIR} — run 01-dump-prod.sh first" >&2
  exit 1
fi

MONGO_URI=$(grep '^MONGODB_URI=' "${BACKEND_DIR}/.env.local" | cut -d= -f2-)
# Strip any /<db> path from the URI so mongorestore doesn't infer a default target DB.
# --nsFrom/--nsTo will do the rewrite.
CLEAN_URI=$(echo "$MONGO_URI" | sed 's|/l2l_dev?|/?|')

echo "Checking whether l2l_prod already exists on the cluster…"
EXISTS=$(mongosh "$MONGO_URI" --quiet --eval "db.adminCommand({listDatabases:1}).databases.filter(d=>d.name==='l2l_prod').length" 2>/dev/null || echo 0)
if [ "${EXISTS}" = "1" ]; then
  if [ "${FORCE:-0}" != "1" ]; then
    echo "ERROR: l2l_prod already exists. Re-run with FORCE=1 to overwrite, or drop it first." >&2
    exit 1
  fi
  echo "l2l_prod exists and FORCE=1 — will --drop during restore."
  DROP_FLAG="--drop"
else
  DROP_FLAG=""
fi

echo "Restoring ${DUMP_DIR}  →  l2l_prod"
mongorestore --uri "${CLEAN_URI}" \
  --nsInclude 'l2l.*' \
  --nsFrom 'l2l.*' --nsTo 'l2l_prod.*' \
  ${DROP_FLAG} \
  --quiet \
  --dir "${SCRIPT_DIR}/dump"

echo "---"
echo "Post-clone collection counts in l2l_prod:"
CLONE_URI=$(echo "$MONGO_URI" | sed 's|/l2l_dev?|/l2l_prod?|')
mongosh "${CLONE_URI}" --quiet --eval "
  const out = [];
  db.getCollectionNames().sort().forEach(c => out.push({ collection: c, count: db.getCollection(c).estimatedDocumentCount() }));
  console.table(out);
"
