#!/usr/bin/env bash
set -euo pipefail

INITIALIZE_DATASET="${INITIALIZE_DATASET:-no}"

if [ "$INITIALIZE_DATASET" = "yes" ]; then
  echo "[entrypoint] INITIALIZE_DATASET=yes, running dataset creation..."
  mkdir -p /code/data
  /code/create-dataset.sh
else
  echo "[entrypoint] INITIALIZE_DATASET=$INITIALIZE_DATASET, skipping dataset creation."
fi

exec "$@"
