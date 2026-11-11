#!/bin/bash
# Builds the France geocoding database from the worldwide Photon dump.
# The dump (about 27 GB) is streamed and filtered on the fly: it is never stored on disk.
set -euo pipefail
DUMP_URL="${PHOTON_DUMP_URL:-https://download1.graphhopper.com/public/photon-dump-planet-1.0-latest.jsonl.zst}"
curl --fail --silent --show-error --location "$DUMP_URL" \
  | zstd --decompress --stdout \
  | java $JAVA_OPTS -jar /app/photon.jar import -import-file - -data-dir /data -country-codes fr -languages fr,en
