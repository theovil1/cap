#!/bin/bash
# Builds the France geocoding database from the worldwide Photon dump.
#
# The dump (about 27 GB) is streamed, never stored. It is sorted by country, so a fast
# awk filter keeps the two header lines and the French places only, and stops the
# download once France has gone by. Photon then parses a small fraction of the dump.
set -euo pipefail
DUMP_URL="${PHOTON_DUMP_URL:-https://download1.graphhopper.com/public/photon-dump-planet-1.0-latest.jsonl.zst}"
COUNTRY="${PHOTON_COUNTRY:-fr}"
DONE_MARK=/tmp/country-complete
rm -f "$DONE_MARK"

# Read a local copy when there is one (see scripts/download-photon-dump.sh), else stream.
if [ -f /dump/planet.jsonl.zst ]; then
  source_cmd=(cat /dump/planet.jsonl.zst)
else
  source_cmd=(curl --fail --silent --show-error --location "$DUMP_URL")
fi

set +o pipefail
"${source_cmd[@]}" \
  | zstd --decompress --stdout \
  | awk -v code="\"country_code\":\"$COUNTRY\"" -v mark="$DONE_MARK" '
      NR <= 2 { print; next }
      index($0, code) { print; seen = 1; miss = 0; next }
      seen && ++miss > 200000 { system("touch " mark); exit }
    ' \
  | java $JAVA_OPTS -jar /app/photon.jar import -import-file - -data-dir /data -j "${PHOTON_THREADS:-4}" \
      -country-codes "$COUNTRY" -languages fr,en
status=("${PIPESTATUS[@]}")
set -o pipefail

if [ "${status[3]}" -ne 0 ]; then
  echo "Photon import failed (exit ${status[3]})" >&2
  exit 1
fi
# Stopping the read early is expected; anything else means the data is incomplete.
if [ ! -f "$DONE_MARK" ] && [ "${status[0]}" -ne 0 ]; then
  echo "Reading the dump failed before the end of the country (exit ${status[0]})" >&2
  exit 1
fi
echo "Photon import finished for country $COUNTRY"
