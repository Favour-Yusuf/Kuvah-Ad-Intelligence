# Kuvah Ad Intelligence — v1 Design

Date: 2026-10-15
Status: Approved in conversation; awaiting written-spec review

## 1. Purpose

An internal tool for the Kuvah team to capture, organise and analyse advertising
creatives from international ecommerce brands, focused on the US and UK markets.

Scope is advertising research only. Out of scope: product discovery, competitor
store intelligence, store or revenue tracking, and unrelated marketing tools.

Success for v1: a team member can capture an ad in under two minutes, find it
again through search and filters, get a structured AI breakdown that separates
captured facts from interpretation, and group and compare ads in collections.

## 2. Background

A REA-assisted investigation of WinningHunter (public pages and a free-plan
session, 2026-10-15) informed the workflow. Patterns reused as ideas, not
implementation:

- Library filters reflected in the URL, with removable filter chips.
- A compact card per ad, with a detail view opened from the card.
- One-click save, with optional folders (collections).
- AI analysis as an explicit, on-demand action rather than precomputed.

Kuvah deliberately does not reproduce spend, revenue or ranking estimates,
store tracking, bulk ad ingestion or creative watermark removal.

## 3. Constraints

- No scraping, undocumented endpoints, or bypassing access controls.
- Kuvah never fetches or analyses arbitrary URLs. The source URL is stored as a
  reference only. Analysis uses content the user typed or uploaded.
- AI output never states revenue, ad spend, ROAS, conversions or other
  performance data.
- Secrets (Supabase service-role key, Anthropic API key) stay server-side.

## 4. Decisions

| Topic | Decision |
|---|---|
| Framework | Next.js 16 App Router, TypeScript. `proxy.ts` (not `middleware.ts`); request APIs (`params`, `searchParams`, `cookies()`) are async |
| UI | Tailwind CSS 4, shadcn/ui |
| Data and auth | Hosted Supabase project (Postgres, Auth, Storage). No local Docker |
| Sign-in | Email magic link, invite only. Public sign-up disabled; `signInWithOtp` uses `shouldCreateUser: false` |
| Reads | Server Components through the user-scoped Supabase client (RLS enforced) |
| Writes | Route Handlers under `app/api`, validated with zod |
| AI | Anthropic Claude (default `claude-opus-5-5`, configurable via `ANTHROPIC_MODEL`) with server-side refusal fallbacks, behind a provider-agnostic `AdAnalyzer` interface |
| Ingestion | Manual capture only, behind an `AdSourceAdapter` interface for future authorised sources |
| Tests | Vitest for unit and route tests. RLS tests apply the migrations to in-process Postgres (PGlite) with Supabase auth/storage shims; no Docker or extra project |

## 5. Architecture

### 5.1 Folder structure

```
app/
  (auth)/login/page.tsx
  auth/callback/route.ts
  (app)/layout.tsx                    authenticated shell; redirects to /login
  (app)/page.tsx                      dashboard
  (app)/ads/page.tsx                  library
  (app)/ads/new/page.tsx              capture
  (app)/ads/[id]/page.tsx             detail
  (app)/ads/[id]/edit/page.tsx
  (app)/collections/page.tsx
  (app)/collections/[id]/page.tsx
  (app)/compare/page.tsx              ?ids=a,b[,c,d]
  (app)/analyses/page.tsx
  api/ads/route.ts                    POST
  api/ads/[id]/route.ts               PATCH, DELETE
  api/ads/[id]/analyses/route.ts      POST
  api/ads/[id]/notes/route.ts         POST
  api/ads/[id]/tags/route.ts          PUT
  api/collections/route.ts            POST
  api/collections/[id]/route.ts       PATCH, DELETE
  api/collections/[id]/items/route.ts POST, DELETE
  api/uploads/route.ts                POST (signed upload URL)
proxy.ts
components/ui/                        shadcn/ui
components/{layout,ads,analysis,collections,dashboard}/
lib/env.ts
lib/supabase/{server,browser,admin}.ts
lib/validation/
lib/data/
lib/analysis/{analyzer,prompt,guardrails}.ts
lib/analysis/providers/{anthropic,fake}.ts
lib/sources/{adapter,manual}.ts
supabase/migrations/
supabase/seed.sql
tests/unit/
tests/rls/
.env.example
```

### 5.2 Unit boundaries

- `lib/env.ts`: parses env vars with zod. Server-only values are importable only
  from server modules (`server-only`).
- `lib/supabase/server.ts`: user-scoped client built from request cookies.
  `admin.ts`: service-role client, server-only, used solely to persist analysis
  results.
- `lib/validation`: zod schemas shared by forms and Route Handlers. Single source
  for enums (platform, format, country list, analysis status).
- `lib/data`: typed query and mutation functions taking a Supabase client.
  Pages and Route Handlers call these, never raw queries.
- `lib/analysis`: `AdAnalyzer.analyze(input) -> AnalysisResult`. The provider
  returns raw output; `guardrails.ts` validates the schema, verifies quotes, and
  rejects performance claims. Providers are swappable without touching routes.
- `lib/sources`: `AdSourceAdapter { id; label; toAdDraft(input) }`. v1 ships only
  `manual`, which maps form input to an ad draft. Future adapters must use
  authorised, documented APIs.

## 6. Data model

All tables in `public`, UUID primary keys, `created_at` and `updated_at`
maintained by triggers.

### 6.1 Tables

**team_members**: `user_id` (PK, FK `auth.users`), `role` (`admin` | `member`),
`display_name`, `created_at`.

**ads**

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| created_by | uuid | defaults to `auth.uid()`, not client-settable |
| source_type | text | `manual` in v1 |
| source_url | text | required, `https://` only, max 2048 |
| brand | text | required, max 120 |
| platform | enum | `facebook`, `instagram`, `tiktok`, `google` |
| target_country | char(2) | ISO 3166-1 alpha-2; UI lists US and GB first |
| industry | text | max 80; UI suggests existing values |
| format | enum | `image`, `video`, `carousel`, `text`, `other` |
| headline | text | max 300 |
| ad_copy | text | max 5000 |
| creative_description | text | max 3000 |
| cta | text | max 80 |
| observed_at | date | required, not in the future |
| research_notes | text | max 5000 |
| marketing_angle | text | set by a person; may accept an AI suggestion |
| creative_path | text | Storage object path, nullable |
| search | tsvector | generated from brand, headline, ad_copy, creative_description, research_notes |

Indexes: GIN on `search`; btree on `platform`, `target_country`, `format`,
`industry`, `observed_at`.

**ad_analyses**: `id`, `ad_id` (FK, cascade), `status` (`pending` | `complete` |
`failed`), `provider`, `model`, `input_hash`, `result` (jsonb), `error` (text),
`created_by`, `created_at`, `completed_at`.

**collections**: `id`, `name` (required, max 120), `description`, `created_by`,
timestamps.

**collection_items**: `collection_id`, `ad_id` (composite PK, both cascade),
`added_by`, `added_at`, `note` (max 2000).

**tags**: `id`, `name` (citext, unique, max 40). **ad_tags**: `ad_id`, `tag_id`
(composite PK).

**ad_notes**: `id`, `ad_id` (FK, cascade), `author`, `body` (required, max
5000), `created_at`.

**View ad_library**: `ads` joined with the latest `ad_analyses` row per ad,
exposing `analysis_status` (`none` when no row). Defined with
`security_invoker = true` so RLS applies.

### 6.2 Row Level Security

- `is_team_member()`: `security definer`, `stable`, returns whether
  `auth.uid()` has a `team_members` row. `is_team_admin()` is the same for
  `role = 'admin'`.
- Every table has RLS enabled. Members may select all rows and insert rows.
  Updates are allowed for members. Deletes are limited to the row's creator or
  an admin.
- `team_members` is readable by members and writable only by admins.
- `created_by`, `author` and `added_by` default to `auth.uid()`. A check
  constraint or trigger rejects other values.
- `ad_analyses` inserts and updates come from the analysis Route Handler: a
  `pending` row inserted with the user client, then completed with the admin
  client.
- Storage: private bucket `creatives`, accepting `image/jpeg`, `image/png`,
  `image/webp` and `video/mp4`, max 25 MB. Object policies mirror
  `is_team_member()`. Images are displayed through short-lived signed URLs.

## 7. AI creative analysis

### 7.1 Input

Built only from the ad record: brand, platform, country, format, headline,
ad_copy, creative_description, cta, and optionally the uploaded image (images
only; video is described by the user in `creative_description`).
`source_url` is never sent for fetching.

### 7.2 Output schema

Each interpreted field is
`{ value: string, basis: "interpretation", supporting_quote: string | null }`.

Fields: `opening_hook`, `customer_problem_or_desire`, `intended_audience`,
`value_proposition`, `offer_and_incentives`, `call_to_action`,
`marketing_angle`, `creative_format_and_structure`,
`possible_effectiveness_reasons` (list), `test_ideas` (list of original ideas,
each with a rationale), and `limitations` (what the input did not allow it to
judge).

The schema has no fields for spend, revenue, ROAS, conversions, reach,
impressions or other performance data.

### 7.3 Guardrails (`lib/analysis/guardrails.ts`)

1. Parse against the zod schema. Invalid output marks the run `failed` with a
   readable error.
2. Every `supporting_quote` must appear in the input text after whitespace and
   case normalisation. Otherwise it is set to `null`.
3. Text matching performance claims (currency amounts tied to spend or revenue,
   ROAS, CPA, CTR, conversion rates, sales figures) causes that field to be
   replaced with a neutral notice and the run to record a warning.
4. `test_ideas` containing long verbatim runs of the original copy (more than 8
   consecutive words) are rejected as copying.

### 7.4 Route and limits

`POST /api/ads/[id]/analyses`: authenticates, checks membership, enforces a
per-user limit (5 runs per minute, counted from `ad_analyses`), inserts a
`pending` row, calls the analyzer with a 60 s timeout, applies guardrails, and
stores the result or error. It returns the analysis row. The UI shows pending,
complete, failed and retry states.

### 7.5 Display

The ad detail page shows three labelled panes: **Observed** (captured fields
verbatim), **AI interpretation** (each field badged "Interpretation", with its
quote when present), and **Ideas to test** (badged "Original ideas"). A
persistent note states that Kuvah does not estimate spend, revenue, ROAS or
conversions. Earlier runs are listed with model and timestamp.

## 8. Screens and flows

- **Login**: email field and magic link. Unknown or uninvited emails receive
  the same neutral message. The callback exchanges the code and redirects.
- **Dashboard**: saved ads, analysed ads, ads awaiting analysis, ads by
  platform, ads by country, the 10 most recent captures, and recent collection
  activity.
- **Library**: a search box plus filters for platform, country, format,
  industry, marketing angle, analysis status and tag, all in URL search params,
  shown as removable chips. Sort by date observed or date captured. Paginated,
  24 per page.
  - Card: brand, platform and country badges, headline, a copy excerpt, CTA, an
    analysis status chip, date observed, and the source link.
  - Selecting 2–4 cards enables Compare and Add to collection.
- **Capture and edit**: the ten fields plus an optional creative upload. Upload
  requires a checkbox confirming the team may store the creative for internal
  research. Client and server validation share zod schemas.
- **Ad detail**: the three panes, run or re-run analysis, analysis history,
  notes (timestamped, by author), tags, collection membership, edit and delete.
- **Collections**: list with counts; collection page with items, per-item
  notes, and remove. Compare is available from the selection.
- **Compare**: 2–4 ads as columns, rows for hook, offer, angle, audience, CTA,
  format, platform and country, using the latest complete analysis or "Not
  analysed".
- **Analyses**: past runs across ads, filterable by status and date.
- **State handling**: every data view has a loading skeleton (`loading.tsx`),
  an empty state with a next action, an error boundary (`error.tsx`) with
  retry, and toast feedback for mutations.

## 9. Security

- Route Handlers authenticate with `supabase.auth.getUser()` and check
  membership before any mutation.
- zod validation on every request body and on query params used in queries.
  Unknown keys are stripped.
- Text is rendered as text (React escaping); no `dangerouslySetInnerHTML`.
  `source_url` is shown with `rel="noopener noreferrer"`.
- Uploads go through signed upload URLs scoped to a generated path, with MIME
  type and size enforced by bucket settings.
- `.env.example` contains placeholders only. `.env*.local` stays gitignored.

## 10. Testing

- **Unit (Vitest)**: validation schemas (valid and invalid capture input, URL
  scheme, future dates), library filter param parsing, guardrails (quote
  verification, performance-claim rejection, copying detection, schema
  failure), the fake analyzer, the manual source adapter, and compare-row
  building.
- **Route handlers**: analysis route with the fake analyzer (success, failure,
  rate limit, unauthenticated, non-member) using a mocked data layer.
- **RLS (`tests/rls`)**: against in-process Postgres (PGlite) with the real migrations;
  a non-member cannot read or write; a
  member cannot delete another member's ad; an admin can.
- Lint and `next build` must pass before each module is marked complete.

## 11. Implementation sequence

1. Foundation: dependencies, shadcn/ui, env, Supabase clients, `proxy.ts`,
   magic-link login, app shell.
2. Database: migrations, RLS, storage, seed, RLS tests.
3. Domain: zod schemas and the data layer, with unit tests.
4. Capture, ad detail (Observed pane), edit and delete.
5. Library search and filters.
6. Analysis: interface, fake and Claude providers, guardrails, route, UI,
   history, tests.
7. Collections, notes and tags.
8. Compare.
9. Dashboard.
10. Hardening: accessibility pass and a README covering setup, inviting users,
    and adding a source adapter.

## 12. External services

| Service | Needed for | Cost |
|---|---|---|
| Supabase (hosted project) | DB, auth, storage | Free tier at first; paid plans from about $25/month. Check current pricing |
| Supabase test project | Optional RLS tests | Free tier |
| Anthropic API | Analysis | Pay per token; confirm current pricing before relying on estimates |

No Meta, TikTok or Google APIs are used in v1.

## 13. Out of scope for v1

Automatic ingestion, browser extension, video frame analysis, spend or
performance estimates, store tracking, multi-workspace support, public
sharing, and exports.
