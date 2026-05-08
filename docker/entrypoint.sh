#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="/code/data"

if [ ! -d "$DATA_DIR" ]; then
  mkdir -p "$DATA_DIR"
fi

if [ -z "$(ls -A "$DATA_DIR")" ]; then
  echo "[entrypoint] $DATA_DIR is empty, creating dataset..."
  /code/create-dataset.sh
else
  echo "[entrypoint] $DATA_DIR already contains data, skipping dataset creation."
fi

exec "$@"
