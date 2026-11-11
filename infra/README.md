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
docker compose run --rm photon-import      # streams the 27 GB worldwide dump, keeps France (hours)
docker compose --profile full up -d --build
```

GraphHopper imports the extract on its first start (about 20 minutes), then loads the prepared graph in seconds. To update the map data, download a new extract, delete `data/graphhopper/graph-cache` and restart.

## Day to day

```bash
docker compose up -d db                    # development: database only
docker compose --profile full up -d        # everything
docker compose logs -f api
```

## Walking profile

`foot_safe` keeps GraphHopper's foot model and adds Cap's safety rules: motorways and expressways (`trunk`) are excluded, primary roads are heavily penalised (x0.1), secondary roads strongly (x0.35) and tertiary roads slightly (x0.7). GraphHopper's foot priority already favours footways, paths, cycleways, residential streets and roads tagged with a sidewalk. Busy roads are penalised rather than banned so that a route always exists in the countryside, where sidewalk data is incomplete.

## Production

Put a reverse proxy with HTTPS in front of the API, keep `API_BIND=127.0.0.1` and set `BEHIND_PROXY=true` so that rate limiting uses the real client IP.
