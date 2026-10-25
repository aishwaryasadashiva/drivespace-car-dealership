#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

printf '\n== Backend tests ==\n'
(
  cd "$ROOT_DIR/backend"
  PYTHONPATH=. python3 -m pytest -v
)

printf '\n== Frontend production build ==\n'
(
  cd "$ROOT_DIR/frontend"
  npm run build
)

printf '\n== Frontend lint ==\n'
(
  cd "$ROOT_DIR/frontend"
  npm run lint
)

printf '\nAll configured checks passed.\n'
