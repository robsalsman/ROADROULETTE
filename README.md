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

For a normal production deployment, run the API as a Node service with `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, and `AI_INTEGRATIONS_OPENAI_BASE_URL` set, and serve the frontend static build from `artifacts/top-gear-game/dist/public`. Configure your host or reverse proxy so frontend `/api/*` requests reach the Express API.

## Notes From The Replit Migration

- The app remains a PNPM workspace; package managers were not converted.
- Replit runtime/state files are ignored, and local development no longer depends on Replit-provided `PORT`, `BASE_PATH`, or Linux-only native package overrides.
- Existing UI, gameplay routes, API route paths, assets, database schema, and integrations are preserved.
