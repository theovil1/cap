# Infrastructure

Docker Compose stack for Cap: PostgreSQL, the API, GraphHopper (walking routes) and Photon (geocoding), with OpenStreetMap data for France.

| Service | Image | Notes |
| --- | --- | --- |
| `db` | `postgres:18.6` | Data in the `db-data` volume |
| `api` | built from `../api` | Port 8080 on 127.0.0.1 by default |
| `graphhopper` | GraphHopper 11.1 on Temurin 25 | Profile `foot_safe` (see `graphhopper/foot_safe.json`), data in `data/graphhopper` |
| `photon` | Photon 1.3.0 on Temurin 25 | France only, data in `data/photon` |

## First start

Needs about 12 GB of RAM during the GraphHopper import and about 40 GB of disk.

```bash
cp .env.example .env                       # set the passwords and JWT_SECRET
sh scripts/download-osm.sh                 # France extract, about 4.5 GB
docker compose run --rm photon-import      # streams the worldwide dump, keeps France (about 30 min)
docker compose --profile full up -d --build
```

GraphHopper imports the extract on its first start (about 40 minutes for two profiles, 8 GB heap), then loads the prepared graph in seconds. To update the map data, download a new extract, delete `data/graphhopper/graph-cache` and restart.

The Photon dump is sorted by country: `photon/import.sh` keeps the French lines with a fast filter and stops the download once France has gone by, so Photon only parses a small part of the 27 GB dump.

### Servers with little memory

Import on a bigger machine, copy `data/graphhopper/graph-cache` and `data/photon` to the server, then set `GRAPHHOPPER_STORAGE=MMAP` and `GRAPHHOPPER_HEAP=1500m`: the graph is then read from disk and GraphHopper uses about 200 MB of RAM.

## Day to day

```bash
docker compose up -d db                    # development: database only
docker compose --profile full up -d        # everything
docker compose logs -f api
```

## Walking profile

Cap's rule is the fastest of the safe routes. `foot_safe` keeps GraphHopper's foot model and adds Cap's safety rules: motorways and expressways (`trunk`) are excluded, primary roads are heavily penalised (x0.1), secondary roads strongly (x0.35) and tertiary roads slightly (x0.7). GraphHopper's foot priority already favours footways, paths, cycleways, residential streets and roads tagged with a sidewalk. Busy roads are penalised rather than banned so that a route always exists in the countryside, where sidewalk data is incomplete.

`foot_fast` (no penalty) is kept as a reference. On six real trips, `foot_safe` cut the share of busy roads from up to 14 % to 0 to 2 %, for a 5 to 9 % longer route.

## Production

Put a reverse proxy with HTTPS in front of the API (example: `nginx/cap.theovilain.fr.conf`, certificate from certbot), keep `API_BIND=127.0.0.1` and set `BEHIND_PROXY=true` so that rate limiting uses the real client IP.
