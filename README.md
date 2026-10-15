# Kuvah Ad Intelligence

Internal tool for the Kuvah team to capture, organise and analyse advertising creatives from ecommerce brands, focused on the US and UK. It covers advertising research only.

- **Capture** an ad you found anywhere: source link, brand, platform, country, copy, creative description, optional creative upload.
- **Library** with full-text search and filters (platform, country, format, industry, marketing angle, analysis status, tag). Filters live in the URL, so views can be shared.
- **AI analysis** of the captured content: hook, problem or desire, audience, value proposition, offer, CTA, angle, structure, hypotheses about why it works, and original test ideas. Interpretations are labelled as such and kept separate from what was observed.
- **Collections**, team notes, tags, side-by-side **comparison** and a **dashboard**.

Kuvah never fetches the source URL and never estimates spend, revenue, ROAS or conversions.

Design spec: [docs/superpowers/specs/2026-10-15-kuvah-ad-intelligence-v1-design.md](docs/superpowers/specs/2026-10-15-kuvah-ad-intelligence-v1-design.md).

## Stack

Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4 and shadcn/ui (Base UI), Supabase (Postgres, Auth, Storage), and Anthropic Claude behind a replaceable analyzer interface.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Run the migrations** in `supabase/migrations/`, in filename order. Either:
   - paste each file into the dashboard's SQL editor and run it, or
   - use the CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
3. **Authentication → Sign In / Providers**:
   - Keep **Email** enabled and **turn off "Allow new users to sign up"**. Access is invite-only.
4. **Authentication → URL Configuration**:
   - Site URL: your app URL (`http://localhost:3000` for local development).
   - Redirect URLs: add `http://localhost:3000/auth/callback` and your production equivalent.

### 2. Invite the team

1. **Authentication → Users → Invite user** for each person.
2. Give them access by adding a `team_members` row in the SQL editor. The first person must be an admin:

   ```sql
   insert into public.team_members (user_id, role, display_name)
   select id, 'admin', 'Your Name' from auth.users where email = 'you@kuvah.com';
   ```

   Use `'member'` for everyone else. Someone who can sign in but has no `team_members` row sees nothing: every table is protected by Row Level Security.

3. Optional: run `supabase/seed.sql` to add three fictional demo ads and a collection.

### 3. Environment

```bash
cp .env.example .env.local
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API keys (publishable, or legacy `anon`) |
| `SUPABASE_SECRET_KEY` | Project Settings → API keys (secret, or legacy `service_role`). **Server-only.** |
| `NEXT_PUBLIC_SITE_URL` | The app's public URL |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com). **Server-only.** |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-opus-5-5`; `claude-sonnet-5-5` costs about half |
| `ANALYSIS_PROVIDER` | `anthropic`, or `fake` for deterministic offline analysis (no API key needed) |

`.env.local` is gitignored. Only `.env.example`, which contains placeholders, is committed.

### 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit, route and database (RLS) tests
npm run lint
npm run typecheck
npm run build
```

## Testing

- `tests/unit`: validation, filters, AI guardrails, comparison, dashboard maths, and Route Handlers with mocked auth and data.
- `tests/rls`: applies the real migrations to an in-process Postgres ([PGlite](https://pglite.dev)) with small stand-ins for Supabase's `auth` and `storage` schemas, then checks the access rules: non-members see nothing, members cannot spoof authorship or write analysis results, deletes are limited to the creator or an admin. No Docker or Supabase project is needed.

These tests don't cover Supabase's hosted Auth and Storage services themselves. After setup, sign in, capture an ad with an image, run an analysis and delete a test ad once, end to end.

## How it fits together

```
app/(app)/…            pages: Server Components; data reads stream in behind <Suspense>
app/api/…              Route Handlers for every write (auth + zod + same-origin check)
lib/auth.ts            session + team membership (pages redirect, APIs return 401/403)
lib/data/…             all database access, through the user's RLS-scoped client
lib/validation/…       zod schemas shared by forms and APIs
lib/analysis/…         AdAnalyzer interface, Claude + fake providers, prompt, guardrails
lib/sources/…          AdSourceAdapter interface (manual capture in v1)
supabase/migrations/   schema, RLS, storage bucket and policies
```

### AI analysis safeguards

- The model sees only what a team member typed, plus an image only if one was uploaded with the permission checkbox ticked. The source URL is never sent or fetched.
- The output must match a fixed schema (Anthropic structured outputs), then passes through `lib/analysis/guardrails.ts`:
  - quotes that don't appear in the captured text are removed;
  - statements about spend, revenue, ROAS, conversions or reach are withheld;
  - test ideas that reuse more than 8 consecutive words of the original are dropped.
- Server-side refusal fallback is on: if the model declines for policy reasons, Anthropic retries on its recommended fallback model.
- Members can start an analysis, but only the server (secret key) can write its result. Runs are limited to 5 per member per minute, with a 90-second deadline. Runs stuck for more than 3 minutes show as failed.

### Adding an authorised data source

Implement `AdSourceAdapter` in `lib/sources/` and register it in `lib/sources/manual.ts`'s `SOURCES` map. Rules:

- Use only documented APIs or feeds the team is authorised to use. Never scrape, call undocumented endpoints or bypass access controls.
- Return drafts for a person to review. The adapter's `id` is stored in `ads.source_type`.
- Don't assume platform ad libraries offer free, unrestricted APIs; check each one's terms and coverage first.

## Costs

- **Supabase:** the free tier is likely enough to start; paid plans begin around $25/month.
- **Anthropic:** pay-per-use. Each analysis is one request with a short prompt, typically a few cents or less on Opus 5.5, about half that on Sonnet 5.5. Check current pricing.
