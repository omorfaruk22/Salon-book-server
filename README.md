# SalonBook Server

SalonBook Server is the TypeScript REST API for the SalonBook appointment platform. It serves the Next.js client, stores application data in MongoDB, verifies Better Auth sessions and JWTs, and reconciles Stripe payments through signed webhooks.

## Features

- Public service browsing and Admin-only service management.
- Customer appointment requests, availability, cancellation, and booking history.
- Admin appointment, customer, dashboard, and transaction management.
- Better Auth email/password sign-in with optional Google OAuth.
- Customer/Admin role checks, blocked-account enforcement, rate limits, request validation, security headers, and centralized error handling.
- Stripe Checkout, signed webhook verification, and payment reconciliation.
- Admin-protected ImgBB image uploads and database-aware health check.

## Technologies

Node.js, Express 4, TypeScript, MongoDB Atlas, Mongoose, Better Auth MongoDB adapter/JWT plugin, Stripe SDK, ImgBB API, Zod, and jose.

## Folder structure

    src/
      config/             Environment, database, auth, and Stripe configuration
      middleware/         Authentication, rate limits, logging, security, errors
      modules/
        admin-dashboard/  Admin metrics and analytics
        appointments/     Customer and admin booking workflows
        dashboard/        Customer dashboard summary
        health/           Health endpoint
        services/         Service browse and Admin CRUD
        transactions/     Checkout, webhook, history, Admin reads
        uploads/          Validated image upload endpoints
        users/             Customer profile and Admin customer controls
      scripts/             Admin promotion and initial service seeding
      utils/               Shared sanitation helpers
      app.ts               Middleware and route composition
      server.ts            Startup and process lifecycle
    tests/                 Validation, auth policy, payments, and security tests
    render.yaml            Render service and health-check configuration

## Application data and MongoDB

Mongoose manages the four SalonBook application collections:

- users: application profile, Better Auth user id, role, account status, and profile fields.
- services: service details, category, price, duration, image, and active state.
- appointments: customer/service references, immutable service snapshot, schedule, booking state, and payment state.
- transactions: appointment/customer references, amount/currency, Stripe identifiers, payment state, and timestamps.

Better Auth maintains separate authentication collections for identity, sessions, accounts, verifications, and signing-key data. Application profiles link to auth records through authUserId.

The database name is derived from the path in MONGODB_URI. For Atlas, allow the API host in Atlas network access. Never commit the URI.

## Installation

Requirements: Node.js 20 or later and npm.

Clone the repository and install dependencies:

    git clone https://github.com/omorfaruk22/Salon-book-server.git
    cd Salon-book-server
    npm install

Copy .env.example to .env, fill in the required values above, then run:

    npm run dev

The API listens on http://localhost:4000 by default.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| MONGODB_URI | Yes | MongoDB connection string; keep private |
| BETTER_AUTH_SECRET | Yes | Random secret with at least 32 characters; keep private |
| CLIENT_ORIGIN or CLIENT_URL | Yes in production | Exact frontend origin, without trailing slash |
| BETTER_AUTH_URL or SERVER_URL | Yes | Public API origin, without trailing slash |
| NODE_ENV | No | development, test, or production; defaults to development |
| PORT | No | API port; defaults to 4000 and uses the host port in production |
| STRIPE_SECRET_KEY | No for startup | Required to create Stripe Checkout sessions; keep private |
| STRIPE_WEBHOOK_SECRET | No for startup | Signing secret for the configured webhook; keep private |
| IMGBB_API_KEY | No for startup | Enables image upload; keep private |
| GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET | Optional pair | Set both on the API host to enable Google OAuth; keep the secret private |

The example file includes localhost defaults. In production use the deployed HTTPS client/API origins. The client proxies /api/* to this API so Better Auth cookies remain first-party. Never place server secrets in frontend variables.

### Google OAuth provider setup

Create an OAuth 2.0 Client ID of type **Web application** in Google Cloud Console. Register these authorized JavaScript origins and redirect URIs:

| Environment | Authorized origin | Authorized redirect URI |
| --- | --- | --- |
| Production | `https://salon-book-client-8wvq.vercel.app` | `https://salon-book-client-8wvq.vercel.app/api/auth/callback/google` |
| Local | `http://localhost:3000` | `http://localhost:3000/api/auth/callback/google` |

Add the generated `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the Render `salonbook-server` service environment, then redeploy the API. Do not put either value in a `NEXT_PUBLIC_*` variable. The Google callback uses the client origin because the client proxies `/api/auth/*` to the API.

## REST API

All routes use the /api prefix. Protected endpoints require a valid Better Auth session/token and check the current application role and blocked status. Responses use a data/error JSON envelope. Admin means an authenticated Admin; Customer means an authenticated, active customer.

### Health and authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | /api/health | Public | API and database readiness |
| ALL | /api/auth/* | Auth flow | Better Auth sign-up, sign-in, sign-out, session, OAuth, token, and JWKS routes |
| POST | /api/auth/sign-up/email | Public | Register a customer |
| POST | /api/auth/sign-in/email | Public | Sign in with email/password |
| POST | /api/auth/sign-out | Session | End the current session |
| GET | /api/auth/token | Session | Issue short-lived API JWT |
| GET | /api/auth/jwks | Public key set | Publish verification keys |

### Services

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | /api/services | Public | Search, filter, sort, paginate active services |
| GET | /api/services/:id | Public | Read service details |
| GET | /api/services/admin | Admin | List services, including inactive ones |
| GET | /api/services/admin/:id | Admin | Read service for editing |
| POST | /api/services | Admin | Create service |
| PATCH | /api/services/:id | Admin | Update service |
| PATCH | /api/services/:id/status | Admin | Activate/deactivate service |
| DELETE | /api/services/:id | Admin | Delete eligible service |

### Appointments

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | /api/appointments/availability | Customer | Read available slots |
| GET | /api/appointments/my-stats | Customer | Read appointment summary |
| GET | /api/appointments/my-appointments | Customer | List customer bookings |
| GET | /api/appointments/my-appointments/:id | Customer | Read owned booking details |
| GET | /api/appointments | Customer | List current customer's bookings |
| GET | /api/appointments/:id | Customer | Read an owned appointment |
| POST | /api/appointments | Customer | Request an appointment |
| PATCH | /api/appointments/:id/cancel | Customer | Cancel an eligible pending booking |
| GET | /api/admin/appointments | Admin | List/filter appointments |
| GET | /api/admin/appointments/:id | Admin | Read appointment details |
| PATCH | /api/admin/appointments/:id/confirm | Admin | Confirm a pending appointment |
| PATCH | /api/admin/appointments/:id/cancel | Admin | Cancel an appointment |
| PATCH | /api/admin/appointments/:id/complete | Admin | Mark appointment complete |

### Users and dashboards

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | /api/users/me | Session | Read own profile |
| PATCH | /api/users/me | Customer | Update own profile |
| GET | /api/admin/users | Admin | List/search customers |
| GET | /api/admin/users/:id | Admin | Read customer details |
| PATCH | /api/admin/users/:id/block | Admin | Block a customer |
| PATCH | /api/admin/users/:id/unblock | Admin | Unblock a customer |
| GET | /api/dashboard/summary | Customer | Customer dashboard summary |
| GET | /api/admin/check | Admin | Check Admin access |
| GET | /api/admin/dashboard/stats | Admin | Admin metrics |
| GET | /api/admin/dashboard/recent-appointments | Admin | Recent bookings |
| GET | /api/admin/dashboard/recent-transactions | Admin | Recent transactions |
| GET | /api/admin/dashboard/appointment-analytics | Admin | Appointment analytics |

### Payments and uploads

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | /api/transactions/checkout-session | Customer | Create Checkout for eligible appointment |
| GET | /api/transactions/verify/:sessionId | Customer | Verify signed-in customer's Checkout result |
| GET | /api/transactions | Customer | List own payment history |
| GET | /api/transactions/:id | Customer | Read own transaction/receipt |
| POST | /api/transactions/webhook | Stripe signature | Reconcile payment, expiry, failure, and refund |
| GET | /api/admin/transactions | Admin | List/filter transactions |
| GET | /api/admin/transactions/stats | Admin | Read transaction totals |
| GET | /api/admin/transactions/:id | Admin | Read transaction details |
| POST | /api/uploads/image | Admin | Upload service image |
| POST | /api/uploads/profile-image | Customer or Admin | Upload profile image |

The webhook requires Stripe's raw request body and a valid Stripe-Signature. Use Stripe CLI and its local signing secret for local tests. For a hosted webhook, configure its endpoint signing secret as STRIPE_WEBHOOK_SECRET. A browser redirect alone never marks a payment paid.

## Authentication and Admin provisioning

Better Auth manages registration, email/password authentication, sessions, optional Google OAuth, and JWT signing keys. Express verifies API JWTs through JWKS and checks the Mongoose profile role/status. Public registration always creates a Customer.

To promote an already registered account, run this from the server repository and use that account's email:

    npm run admin:promote -- admin@example.com

Sign out and back in after promotion. The command refuses to promote an email without an existing Better Auth account.

## Stripe and image uploads

Set STRIPE_SECRET_KEY for Checkout. Configure a Stripe endpoint at /api/transactions/webhook, then save its signing secret as STRIPE_WEBHOOK_SECRET. Handled events include successful, failed, and expired Checkout sessions and refunds. Use Stripe test keys for testing.

Set IMGBB_API_KEY to enable protected image uploads. Accepted profile/service image types are JPEG, PNG, or WebP, up to 5 MB.

## Development commands

    npm run dev           Start watched TypeScript server
    npm run typecheck     Run the TypeScript check
    npm run build         Compile into dist/
    npm start             Start the compiled API
    npm test              Run the validation/security test suite
    npm run seed:services Seed the initial service catalog
    npm run admin:promote -- admin@example.com  Promote an existing account

## Verification

Run npm run typecheck, npm run build, and npm test before merging changes. Keep .env, Atlas credentials, Better Auth secrets, Stripe secrets, and ImgBB keys out of Git.

## Related repository

SalonBook Client: https://github.com/omorfaruk22/Salon-book-client
