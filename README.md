# SalonBook Server

Express + TypeScript API for the SalonBook Next.js client. Domain modules and their Mongoose models live in `src/modules`. Better Auth keeps its own authentication collections; the four Mongoose application models are `users`, `services`, `appointments`, and `transactions`.

## Local setup

1. Copy `.env.example` to `.env` in this server folder.
2. Fill in `MONGODB_URI` and a `BETTER_AUTH_SECRET` of at least 32 characters.
3. Set `CLIENT_URL` to `http://localhost:3000` and `SERVER_URL` to `http://localhost:4000`.
4. Run `npm install`, then `npm run dev`.

The existing Render environment variable names `CLIENT_ORIGIN` and `BETTER_AUTH_URL` are still supported as aliases for `CLIENT_URL` and `SERVER_URL`. If both names are set, the existing names take precedence. The API listens on the platform-provided `PORT`, or `4000` locally. Never copy a MongoDB URI or server secret into the client repository or a `NEXT_PUBLIC_*` variable.

## API and database

- `GET /api/health` reports server status, MongoDB connection status, environment, and an ISO timestamp. It returns HTTP 503 until MongoDB is connected.
- `/api/users`, `/api/services`, `/api/appointments`, `/api/transactions`, `/api/dashboard`, and `/api/admin` are mounted as organized route modules. `/api/transactions` is the existing frontend-compatible payments route.
- Application collections are managed by Mongoose. Better Auth's user, session, account, verification, and key data remain in separate auth collections.
- CORS allows the configured client origin with credentials; it does not allow arbitrary origins. Request logs contain only method, path, response status, and duration.

## Environment variables

Required at startup:

- `MONGODB_URI` — MongoDB Atlas connection string.
- `BETTER_AUTH_SECRET` — random secret with at least 32 characters.
- `SERVER_URL` or `BETTER_AUTH_URL` — public API origin.
- `CLIENT_URL` or `CLIENT_ORIGIN` — exact public client origin.

`NODE_ENV` and `PORT` are validated and default to `development` and `4000`. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `IMGBB_API_KEY` are optional for server startup because existing integrations report their own missing configuration when used. Google OAuth variables are reserved; Google sign-in is not configured in this phase.

## Scripts

- `npm run dev` — development API with file watching
- `npm run typecheck` — check TypeScript types
- `npm run build` — compile TypeScript into `dist/`
- `npm start` — start the compiled API
- `npm run admin:promote -- <existing-account-email>` — promote an already registered account to admin

## Production deployment (Render)

The root `render.yaml` configures the health check at `/api/health`. Connect this repository in Render and set `CLIENT_ORIGIN` to the deployed client's exact `https://` origin and `BETTER_AUTH_URL` to the API's public `https://` origin, both without trailing slashes. Keep MongoDB and payment keys in the server service environment. Use a production database name separate from local development.

The existing Stripe webhook endpoint is `POST /api/transactions/webhook`. Configure Stripe to send the checkout completion/failure/expiry and refund events handled by this endpoint, then set that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`. Do not use a local Stripe CLI signing secret in production. The ImgBB key is used only by the server-side upload endpoint.
