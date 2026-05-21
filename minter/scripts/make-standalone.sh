#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(cd "$ROOT/.." && pwd)"
OUT_DIR="$PARENT/mintless-minter-standalone"
ZIP="$PARENT/mintless-minter-standalone.zip"

rm -rf "$OUT_DIR" "$ZIP"
mkdir -p "$OUT_DIR"

(cd "$ROOT" && tar --exclude=node_modules --exclude=.next --exclude=dev.db --exclude=.env -cf - .) | tar -C "$OUT_DIR" -xf -

cd "$PARENT"
zip -rq "$ZIP" "$(basename "$OUT_DIR")"

echo "Готово:"
echo "  Папка: $OUT_DIR"
echo "  ZIP:   $ZIP"
