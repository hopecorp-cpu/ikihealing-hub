# Ops Hub

An internal operating system for small retail businesses (roughly 5 to 50 people). One place for attendance, payroll, KPIs, tasks, customers, orders, content, ads, reports, and a team of background AI assistants.

It was extracted from a system that a Vietnamese company runs in production. All data, people, prices and private configuration have been replaced with samples. The sample company is **ACME Corp**, the retail brand is **NOVA**, and the products are **Sản phẩm A, B, C** (Product A, B, C). The user interface is in Vietnamese, with partial English and Japanese translations (switch at the top of the screen).

- Operations map (Vietnamese, with diagrams): [docs/SO-DO-VAN-HANH.md](docs/SO-DO-VAN-HANH.md)
- Feature requests and bug reports: open an [Issue](../../issues/new/choose). English is welcome.

## What is inside

| Area | Main features |
|---|---|
| Daily work | Today's tasks, kanban board, daily plan, GPS attendance, leave requests with approval |
| Sales and customers | Automatic lead assignment, customer 360 and RFM, order attribution to sales staff, unified Zalo inbox |
| Marketing and content | AI assistants that draft posts, campaign calendar, funnel content routes, ad tracking with a hard budget cap |
| Management and finance | Command center, revenue loop, strategy map, cash flow, shipping and marketplace reconciliation |
| People and pay | Payroll (Vietnamese social insurance and personal income tax), KPIs, leaderboards, hiring, AI CV screening |
| Knowledge | SOPs, knowledge base with quizzes, content compliance checks |
| System | Watchdog for dead data sources, job logs, encrypted API key vault |

About 170 screens, 87 scheduled jobs and 110 database tables.

## Stack

Next.js 14 (App Router), TypeScript, Tailwind, Supabase (Postgres, row level security, pgvector), Vercel Cron, Telegram Bot API, Zalo OA, Meta Graph API, Claude and Gemini.

## Run it locally

You need Node.js 20, Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone <repo-url> ops-hub
cd ops-hub
npm install
supabase init            # skip if supabase/config.toml already exists
supabase start           # starts local Postgres and Auth, prints URL and keys
supabase db reset        # runs all migrations, then loads supabase/seed.sql
cp .env.example .env.local
```

In `.env.local`, fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the `supabase start` output, and set `CRON_SECRET` and `SECRET_VAULT_KEY` to random strings.

```bash
npm run dev
```

Open http://localhost:3000 and sign in as `admin@example.com` with password `matkhau-demo`. Other sample users: `son@example.com` (sales lead), `cuc@example.com` and `dao@example.com` (sales), `hang@example.com` (marketing), `lan@example.com` (accounting), all with the same password.

The seed creates a fake company with 6 staff, 120 customers, 200 leads, about 450 orders over the last 90 days, tasks, attendance and monthly KPIs. Dates are relative to the day you run it. The seed only runs locally; `supabase db push` to a real project starts empty.

There is no sign-up page. Create real users in Supabase Studio (Authentication, Add user), then set `role` in the `users` table (`admin`, `manager` or `employee`).

## Optional integrations

Only the Supabase variables and `CRON_SECRET` are required. Everything else turns on when you add its key and stays off otherwise. See the table in [README.md](README.md#tính-năng-nào-cần-khoá-nào) or the groups in `.env.example`: AI (Anthropic, Gemini), Telegram, Zalo, Facebook/Meta, Google, email (Resend), payments (payOS, ZaloPay), TikTok Shop. Several of these are Vietnam-specific services; outside Vietnam, skip them or write a replacement module in `lib/`.

## Deploy to Vercel

1. Create a Supabase project and apply `supabase/migrations` (`supabase link`, then `supabase db push`).
2. Import the repo into Vercel and add the environment variables.
3. `vercel.json` has 87 cron jobs, many running every few minutes, which needs the Pro plan. On the free Hobby plan, run `cp vercel.hobby.json vercel.json` first: it keeps the 63 jobs that run once a day. High-frequency jobs can be triggered from an external scheduler at `/api/cron/<name>?key=<CRON_SECRET>`.

## Known rough edges

- Code comments were removed when the project was extracted; the design is documented in `docs/` instead.
- `npm run typecheck` reports about 80 type errors, so the build skips type checking. The app runs fine; fixing these is a good first contribution.
- Some modules depend on Vietnamese business practice (payroll law, shipping carriers, Zalo).

## License

MIT. See [LICENSE](LICENSE).
