#!/bin/bash
# Downloads the worldwide Photon dump with parallel range requests: the download server
# limits each connection to a few MB/s. The file (about 27 GB) can be deleted after import.
set -euo pipefail
cd "$(dirname "$0")/.."
URL="${PHOTON_DUMP_URL:-https://download1.graphhopper.com/public/photon-dump-planet-1.0-latest.jsonl.zst}"
PARTS="${PARTS:-12}"
OUT=data/photon-dump/planet.jsonl.zst
mkdir -p data/photon-dump/parts

size=$(curl -sIL "$URL" | awk 'tolower($1) == "content-length:" { n = $2 } END { print n + 0 }' | tr -d '\r')
[ "$size" -gt 0 ] || { echo "cannot read the dump size" >&2; exit 1; }
chunk=$(( (size + PARTS - 1) / PARTS ))
echo "Downloading $((size / 1024 / 1024 / 1024)) GB in $PARTS parts"

for i in $(seq 0 $((PARTS - 1))); do
  start=$((i * chunk)); end=$((start + chunk - 1)); [ "$end" -ge "$size" ] && end=$((size - 1))
  part=data/photon-dump/parts/$(printf '%03d' "$i")
  expected=$((end - start + 1))
  (
    # Resume each part until it has the expected size.
    until [ -f "$part" ] && [ "$(stat -c %s "$part")" -eq "$expected" ]; do
      have=$( [ -f "$part" ] && stat -c %s "$part" || echo 0 )
      curl -sS --fail --retry 5 -r "$((start + have))-$end" "$URL" >> "$part" || sleep 5
    done
  ) &
done
wait

cat data/photon-dump/parts/* > "$OUT"
[ "$(stat -c %s "$OUT")" -eq "$size" ] || { echo "size mismatch" >&2; exit 1; }
rm -rf data/photon-dump/parts
echo "Saved $OUT"
