# Base routes

Classic French walks published in the Explorer by the Cap team account, so a
new walker always finds something to start. Each destination photo comes from
Wikimedia Commons under a free licence (CC BY, CC BY-SA, CC0 or public domain);
the script stores the author and licence with the photo and the app shows them.

```bash
CAP_EMAIL=team@example.org CAP_PASSWORD=... node seed.mjs --api https://cap.theovilain.fr
```

- Signs in with the given account and publishes every route of `routes.json`
  that this account has not published yet (same title).
- Routes are computed by the API (GraphHopper `foot_safe`), like in the app.
- Give the account the `team` badge from the admin API so the routes show who
  published them.
