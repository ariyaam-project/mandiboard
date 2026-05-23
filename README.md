# Mandi Theeta

Nuxt app with Google login, Cloudflare Pages Functions, and Cloudflare D1.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Apply the local D1 migration:

```bash
npm run db:migrate:local
```

3. Run with Cloudflare bindings:

```bash
npm run dev:cf
```

Open:

```txt
http://localhost:8788
```

## Google OAuth

For local development, add these to the Google OAuth client:

```txt
Authorised JavaScript origin:
http://localhost:8788

Authorised redirect URI:
http://localhost:8788/api/auth/google/callback
```

For production:

```txt
Authorised JavaScript origin:
https://theeta.in

Authorised redirect URI:
https://theeta.in/api/auth/google/callback
```

If `www.theeta.in` is enabled, add the matching `www` origin and redirect URI too.

## Cloudflare deployment notes

Create a D1 database named `mandi-theeta`, then replace `database_id` in `wrangler.toml`.

Apply production migrations:

```bash
npm run db:migrate:remote
```

Set these Cloudflare Pages environment variables/secrets:

```txt
NUXT_PUBLIC_APP_URL=https://theeta.in
NUXT_PUBLIC_GOOGLE_CLIENT_ID=...
NUXT_GOOGLE_CLIENT_SECRET=...
NUXT_SESSION_SECRET=...
NUXT_PUBLIC_PENALTY_HOURS_PER_QUARTER=1.5
NUXT_PUBLIC_MAYO_PENALTY_HOURS=1
NUXT_PUBLIC_SOFT_DRINK_PENALTY_HOURS=2
```

Deploy:

```bash
npm run deploy
```
