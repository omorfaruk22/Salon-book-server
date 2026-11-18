# SalonBook Server

Express + TypeScript API. Business modules live in `src/modules`; Better Auth owns its separate authentication collections, while Mongoose models in `users`, `services`, `appointments`, and `transactions` hold application data.

## Local setup

Copy `.env.example` to `.env`, then set `MONGODB_URI`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`. Restart the API after changing environment values. Never commit `.env` or share secret values.

Stripe checkout needs `STRIPE_SECRET_KEY`. The signed webhook endpoint is `POST /api/transactions/webhook`; set `STRIPE_WEBHOOK_SECRET` to the signing secret for that endpoint. For local development, forward Stripe test events to `http://localhost:4000/api/transactions/webhook` with Stripe CLI.

Service image upload is admin-only at `POST /api/uploads/image`; set `IMGBB_API_KEY` on the server. The key never reaches the client.

Promote an already registered account to admin from this server folder with `npm run admin:promote -- <email>`, then sign out and back in to refresh the token.

## Scripts

- `npm run dev` — development API
- `npm run build` — compile TypeScript into `dist/`
- `npm run admin:promote -- <email>` — grant the trusted admin role

## Production deployment (Render)

The root `render.yaml` defines a Node web service with a health check. Connect this repository in Render and provide the prompted environment values. Use a production MongoDB database name separate from the local development database. Set `BETTER_AUTH_URL` to the public API origin and `CLIENT_ORIGIN` to the public client origin, both with `https://` and without a trailing slash. Configure a Stripe webhook at `https://<api-host>/api/transactions/webhook` for the checkout and refund events handled by this API; use that endpoint's signing secret for `STRIPE_WEBHOOK_SECRET`. Do not use the local Stripe CLI signing secret in production.
