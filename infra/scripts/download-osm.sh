#!/bin/sh
# Downloads the OpenStreetMap extract for France (about 4.5 GB) used by GraphHopper.
# Delete data/graphhopper/graph-cache afterwards to force a new import.
set -eu
cd "$(dirname "$0")/.."
mkdir -p data/graphhopper
curl --fail --location --continue-at - --output data/graphhopper/france-latest.osm.pbf \
  https://download.geofabrik.de/europe/france-latest.osm.pbf
