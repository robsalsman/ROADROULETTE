# Road Roulette

Road Roulette is a PNPM workspace app originally built on Replit. It contains a React/Vite game frontend, an Express API, a PostgreSQL database accessed through Drizzle ORM, and OpenAI-compatible banter/chat integrations.

## Architecture

- Frontend: `artifacts/top-gear-game`, React 19, Vite, Wouter, Tailwind CSS, Radix UI, React Query.
- API: `artifacts/api-server`, Express 5 mounted at `/api`.
- Database: PostgreSQL with Drizzle ORM in `lib/db`.
- API contract: OpenAPI in `lib/api-spec/openapi.yaml`; generated React client and Zod schemas live in `lib/api-client-react` and `lib/api-zod`.
- Auth: no server-side auth middleware is currently wired into the API.
- External APIs: OpenAI-compatible client in `lib/integrations-openai-ai-server`.

## Prerequisites

- Node.js 24 or newer.
- PNPM 10. Corepack is recommended:

```powershell
corepack enable
corepack prepare pnpm@10.25.0 --activate
```

- PostgreSQL 16 or another compatible PostgreSQL server.

## Local Setup

1. Install dependencies:

```powershell
pnpm install
```

2. Create your local environment file:

```powershell
Copy-Item .env.example .env
```

3. Edit `.env` and set:

- `DATABASE_URL`: PostgreSQL connection string.
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI-compatible API key for banter/chat features.
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: API base URL, for example `https://api.openai.com/v1`.

The local defaults use API port `5000`, web port `5173`, and frontend base path `/`.

4. Create the database if needed, then push the Drizzle schema:

```powershell
pnpm --filter @workspace/db run push
```

5. Run the app locally:

```powershell
pnpm dev
```

The frontend will be available at `http://localhost:5173`. The Vite dev server proxies `/api` to `http://localhost:5000`, so the existing generated API client continues to call same-origin `/api` routes.

## Useful Commands

```powershell
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run start
pnpm --filter @workspace/top-gear-game run serve
```

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string for API and Drizzle. |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Yes | OpenAI-compatible API key used by banter/chat routes. |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Yes | OpenAI-compatible base URL. |
| `PORT` | No | API server port, defaults to `5000`. |
| `WEB_PORT` | No | Vite dev/preview port, defaults to `5173`. |
| `MOCKUP_PORT` | No | Mockup sandbox dev/preview port, defaults to `5174`. |
| `BASE_PATH` | No | Frontend base path, defaults to `/`. |
| `API_PROXY_TARGET` | No | Vite dev proxy target, defaults to `http://localhost:5000`. |
| `NODE_ENV` | No | Runtime mode. |
| `LOG_LEVEL` | No | API logger level, defaults to `info`. |

## Production Build

Build everything:

```powershell
pnpm run build
```

The API build is emitted to `artifacts/api-server/dist`. The frontend build is emitted to `artifacts/top-gear-game/dist/public`.

For production, run the API as the web service with `NODE_ENV=production`. In production mode the Express app preserves all `/api/*` routes, serves the built frontend from `artifacts/top-gear-game/dist/public`, and falls back to `index.html` for client-side routes.

```powershell
pnpm start
```

## Railway Deployment

Use one Railway web service for this repo. The service builds the API and Vite frontend together, then the Express API serves both `/api/*` and the built React app.

1. Create a Railway project from this repository.
2. Add a Railway PostgreSQL database to the same project.
3. In the web service, set the build command:

```bash
pnpm run build
```

4. Set the start command:

```bash
pnpm start
```

5. Set the required environment variables on the Railway web service:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Provided by the Railway PostgreSQL service. Use Railway's reference/linked variable so it stays in sync. |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Yes | OpenAI-compatible API key for banter/chat routes. |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Yes | OpenAI-compatible base URL, for example `https://api.openai.com/v1`. |
| `NODE_ENV` | Yes | Set to `production` so Express serves the built frontend. |
| `LOG_LEVEL` | No | Defaults to `info`. |

Do not set `PORT` manually on Railway. Railway injects `PORT`, and the API server reads it automatically.

### Railway PostgreSQL And Drizzle

The app uses `pg` and Drizzle with the standard `DATABASE_URL` connection string, so Railway PostgreSQL works without code changes.

After attaching PostgreSQL and setting service variables, push the schema before using database-backed game routes:

```bash
pnpm --filter @workspace/db run push
```

For Railway, run that command from a shell where `DATABASE_URL` points at the Railway PostgreSQL database. Options:

- Run it locally with the Railway CLI environment loaded for the service.
- Run it from a temporary Railway shell/job using the same web service environment.

Use the safer `push` command for normal schema sync. `push-force` exists for destructive/manual recovery cases and should not be part of routine deployment.

### Railway Hosting Strategy

- Public app pages are served by Express from `artifacts/top-gear-game/dist/public`.
- API routes remain under `/api/*`.
- Client-side routes such as `/missions` or `/text-presenter` use the SPA fallback to `index.html`.
- Static assets such as `/images/bolivia.png` are served from the Vite build output.

## Notes From The Replit Migration

- The app remains a PNPM workspace; package managers were not converted.
- Replit runtime/state files are ignored, and local development no longer depends on Replit-provided `PORT`, `BASE_PATH`, or Linux-only native package overrides.
- Existing UI, gameplay routes, API route paths, assets, database schema, and integrations are preserved.
