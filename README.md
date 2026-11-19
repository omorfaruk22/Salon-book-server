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

## Authentication and authorization

- Better Auth owns its authentication identity and session collections (`user`, `session`, `account`, `verification`, and JWT key data) through the native MongoDB adapter. The Mongoose `users` collection remains the SalonBook application profile, keyed by the stable Better Auth user id in `authUserId`.
- Better Auth create/update hooks sync a person's name, email, and image into the profile. They never overwrite the profile's application role or block status. Public email and Google registration are forced to `customer`; `status: "active"` means the profile is not blocked. Existing API role values remain lower-case (`customer`/`admin`) for compatibility.
- `POST /api/auth/sign-up/email` validates full name, email, and password on the server. Passwords need at least 8 characters, one uppercase letter, and one lowercase letter. The role field is not client-writable. Profile image is an optional HTTP(S) URL.
- The public Better Auth base URL is the client origin because the frontend exposes `/api/auth` through its same-origin rewrite. Sessions last 7 days and refresh after 12 hours. Production cookies are HttpOnly and Secure; local development uses SameSite=Lax.
- The Better Auth JWT plugin issues service tokens at `/api/auth/token` and publishes signing keys at `/api/auth/jwks`. Express verifies the signature with remote JWKS plus the configured issuer and audience, then uses the Mongoose profile for the final role and blocked-account check. A JWT is never trusted from its decoded payload alone.
- `authenticate`, `requireRole`, `requireAdmin`, and `requireCustomer` protect API routes. Admins cannot use customer appointment creation, listing, or cancellation endpoints.

### Provision the first Admin

1. Register the chosen account through the normal customer sign-up page.
2. From the server folder, run `npm run admin:promote -- admin@example.com` (use the registered email). The script reads the server's existing environment, updates the Better Auth role and Mongoose profile, and refuses an email that has no Better Auth account.
3. Sign out and sign back in. Never add an Admin role to a public sign-up request or check an email address to auto-promote users during login.

### Google OAuth

Set both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server, then add this Authorized redirect URI in Google Cloud Console:

`https://<your-client-host>/api/auth/callback/google`

For local work use `http://localhost:3000/api/auth/callback/google`. The public callback goes through the frontend's same-origin `/api` rewrite to this API. The Google button is present in the client UI, but sign-in works only after both credentials and the matching redirect URI are configured. Google client secrets stay on the API service.

## Environment variables

Required at startup:

- `MONGODB_URI` — MongoDB Atlas connection string.
- `BETTER_AUTH_SECRET` — random secret with at least 32 characters.
- `SERVER_URL` or `BETTER_AUTH_URL` — API service origin used for the Express API and internal JWKS retrieval. Better Auth's public origin is `CLIENT_URL`/`CLIENT_ORIGIN`, because the client proxies `/api/auth` on the same origin.
- `CLIENT_URL` or `CLIENT_ORIGIN` — exact public client origin.

Optional authentication providers:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — configure both to enable Google OAuth; leave both empty to disable it. Register the client origin's `/api/auth/callback/google` as the Google redirect URI.

`NODE_ENV` and `PORT` are validated and default to `development` and `4000`. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `IMGBB_API_KEY` are optional for server startup because existing integrations report their own missing configuration when used.

## Scripts

- `npm run dev` — development API with file watching
- `npm run typecheck` — check TypeScript types
- `npm run build` — compile TypeScript into `dist/`
- `npm start` — start the compiled API
- `npm run admin:promote -- <existing-account-email>` — promote an already registered account to admin

## Production deployment (Render)

The root `render.yaml` configures the health check at `/api/health`. Connect this repository in Render and set `CLIENT_ORIGIN` to the deployed client's exact `https://` origin and `BETTER_AUTH_URL` to the API's public `https://` origin, both without trailing slashes. Keep MongoDB and payment keys in the server service environment. Use a production database name separate from local development.

The existing Stripe webhook endpoint is `POST /api/transactions/webhook`. Configure Stripe to send the checkout completion/failure/expiry and refund events handled by this endpoint, then set that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`. Do not use a local Stripe CLI signing secret in production. The ImgBB key is used only by the server-side upload endpoint.
