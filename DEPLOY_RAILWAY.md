# Road Roulette Railway Deployment

## Standalone Repository

Road Roulette is configured as a standalone project, separate from unrelated repositories and deployments.

- GitHub repository: `https://github.com/robsalsman/ROADROULETTE`
- Local project path: `C:\Users\robsa\Documents\Road Roulette`
- Git remote: `https://github.com/robsalsman/ROADROULETTE.git`
- Confirmed no unrelated deployment strings, domains, secrets, remotes, assets, workflows, database connections, or deployment configuration were found in this repository during the deployment audit.

## Railway Service Shape

Use one Railway web service for the whole app.

- Do not split frontend and backend into separate Railway services.
- The root build creates both the Express API bundle and the Vite frontend bundle.
- In production, Express serves all `/api/*` routes first, then serves `artifacts/top-gear-game/dist/public` for the React/Vite app.
- Client-side routes use the SPA fallback to `index.html`.
- Railway injects `PORT`; do not set it manually.

## Railway Commands

Build command:

```bash
corepack pnpm install && corepack pnpm run build
```

Start command:

```bash
corepack pnpm run start
```

## Environment Variables

Required:

```bash
DATABASE_URL=<Railway PostgreSQL connection string>
AI_INTEGRATIONS_OPENAI_API_KEY=<OpenAI-compatible API key>
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
NODE_ENV=production
```

Optional:

```bash
LOG_LEVEL=info
```

Notes:

- `DATABASE_URL` should come from the Railway PostgreSQL plugin/attached database.
- Do not configure `PORT`; Railway assigns it automatically.
- Local-only variables such as `WEB_PORT`, `MOCKUP_PORT`, and `API_PROXY_TARGET` are not needed for production.

## PostgreSQL Setup

1. In Railway, create a new project from `https://github.com/robsalsman/ROADROULETTE`.
2. Add a PostgreSQL database to the same Railway project.
3. Attach/reference the PostgreSQL `DATABASE_URL` in the Road Roulette web service.
4. Set the required environment variables listed above.
5. Run the Drizzle schema push against the Railway database:

```bash
corepack pnpm --filter @workspace/db run push
```

Run that command from an environment where `DATABASE_URL` points to the Railway PostgreSQL database. The normal deployment path should use `push`; reserve `push-force` only for manual destructive recovery.

## Deployment Process

1. Confirm the active Git remote is the standalone Road Roulette repo:

```bash
git remote -v
```

2. Push Road Roulette code:

```bash
git push -u origin master
```

3. In Railway, create a single web service from the `road-roulette` GitHub repo.
4. Set the build command:

```bash
corepack pnpm install && corepack pnpm run build
```

5. Set the start command:

```bash
corepack pnpm run start
```

6. Attach PostgreSQL and set environment variables.
7. Run the Drizzle schema push.
8. Deploy.

## Production Validation Checklist

After Railway deploys:

- `/api/healthz` returns success.
- `/` loads the Road Roulette frontend.
- A static asset under `/assets/...` returns `200`.
- SPA routes such as `/series-start`, `/text-presenter`, and `/mission/1` load from the production service.
- Series Mode starts at episode 1.
- Saved games can be created and resumed.
- Presenter/AI routes use the configured OpenAI-compatible environment variables.
- Mobile viewport renders without horizontal layout breakage.

## Isolation Confirmation

Road Roulette must remain completely separate from unrelated repositories, domains, databases, and deployment targets.

Before each production push, confirm:

```bash
git remote -v
rg -n -i "<external project names, domains, or env prefixes>" .
```

Expected result:

- Remote points only to `https://github.com/robsalsman/ROADROULETTE.git`.
- Search returns no unrelated project references.
- No unrelated domains, secrets, deployment files, workflows, database connections, or assets are present.
