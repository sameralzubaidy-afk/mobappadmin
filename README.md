## Sentry Release Uploads

To upload source maps and create a Sentry release during CI, add these secrets to your repo settings:
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG` (Sentry organization slug)
- `SENTRY_PROJECT_ADMIN` (Sentry project slug for admin)
Set the `RELEASE` environment variable during CI (
`RELEASE=${{ github.sha }}`) and the workflow `sentry-release.yml` will create and upload the release automatically.

### Local release upload
To create and upload a release locally (requires SENTRY_AUTH_TOKEN and SENTRY_ORG/PROJECT):
```bash
cd p2p-kids-admin
RELEASE=$(git rev-parse --short HEAD) npm run sentry:release
```

### Helper scripts
We added a script to upload Sentry release for the admin project:
- `scripts/release-sentry.sh` — creates a Sentry release, uploads .next sourcemaps, and finalizes the release. Requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT_ADMIN` environment variables.

Usage:
```bash
cd p2p-kids-admin
export SENTRY_AUTH_TOKEN="<your-token>"
export SENTRY_ORG="<your-org>"
export SENTRY_PROJECT_ADMIN="<your-admin-project>"
export RELEASE=$(git rev-parse --short HEAD)
./scripts/release-sentry.sh
```



# P2P Kids Marketplace — Admin

Small Next.js + TypeScript admin panel skeleton used by the project.

Local dev

1. Copy `.env.local.example` → `.env.local` and set your Supabase keys
2. Install dependencies:

```bash
cd p2p-kids-admin
npm install
```

3. Run dev server:

```bash
npm run dev
```

Sentry
------

The admin panel uses Sentry for error tracking. To enable Sentry locally, add the following to your `.env.local` file:

```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/yyyyy
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/yyyyy
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

Set `NEXT_PUBLIC_ENVIRONMENT` to `development` or `staging` as appropriate. The `sentry.client.config.ts` and `sentry.server.config.ts` files are created in the project root and are used to initialize the SDK.

Notes

- This is a scaffold only — supabase types should be regenerated after running the migrations in the main repo: `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts`.
