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

Notes

- This is a scaffold only — supabase types should be regenerated after running the migrations in the main repo: `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts`.
