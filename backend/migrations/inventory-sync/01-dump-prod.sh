#!/usr/bin/env bash
# Dumps the PROD database (l2l) to ./dump/l2l/ as a local backup.
# No writes anywhere except local disk.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUT_DIR="${SCRIPT_DIR}/dump"

if [ ! -f "${BACKEND_DIR}/.env.local" ]; then
  echo "ERROR: ${BACKEND_DIR}/.env.local not found" >&2
  exit 1
fi

MONGO_URI=$(grep '^MONGODB_URI=' "${BACKEND_DIR}/.env.local" | cut -d= -f2-)
PROD_URI=$(echo "$MONGO_URI" | sed 's|/l2l_dev?|/l2l?|')

mkdir -p "${OUT_DIR}"
echo "Dumping l2l → ${OUT_DIR}/l2l/"
mongodump --uri "${PROD_URI}" --db l2l --out "${OUT_DIR}" --quiet

echo "---"
echo "Dump sizes:"
du -sh "${OUT_DIR}/l2l"/*.bson 2>/dev/null | sort -hr | head -20
echo "Total:"
du -sh "${OUT_DIR}/l2l"
