# Contributing

Thanks for your interest in Cap! The project is young, so please open an issue to discuss a change before starting a large pull request.

## Guidelines

- Everything is written in English: code, comments, commits, docs.
- User-facing text goes through translation files (French and English), never hard-coded.
- Keep pull requests small and focused. Run the linters and tests of the part you touch.
- Never commit secrets: copy `.env.example` to `.env` locally.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(app): show live speed on the session screen
fix(api): reject sessions faster than 20 km/h
docs(tools): document the FitShow status frame
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`. Scopes: `app`, `api`, `infra`, `tools`.

## Adding a treadmill

Use [`tools/ble-probe`](tools/ble-probe) to record your treadmill, then open an issue with the generated `services-*.txt` and `frames-*.csv` files and the model name.
