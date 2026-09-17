# Printello POD — demo

A seller-facing print-on-demand portal: upload artwork, configure a garment,
order it, and track it through production. Built as a demo of the workflow,
separate from the DTF gang-sheet builder in `Printello_DTF/printello-web`.

## Running

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm run dev
```

## Checks

```bash
npx tsc -b        # NOT `tsc --noEmit` — the root tsconfig is a solution file
                  # with "files": [], so a bare invocation checks nothing
npx oxlint src/
npm run build
```

## Supabase

Project `xafotksnuswmmvwduzyf` (org `uorexznqwdqdbrqsvqql`) — **not** the DTF
project `xopspcuqmecvfvnwwqge`. These migrations create `profiles`, `orders`
and a `designs` bucket, all names that already exist on DTF; never point this
repo at that project.

**This project has legacy JWT API keys disabled.** The `anon` key the dashboard
still lists is rejected with `sb-error-code: UNAUTHORIZED_INVALID_API_KEY_TYPE`,
and the failure looks exactly like a wrong key rather than a wrong *kind* of
key. Use the **publishable** key (`sb_publishable_...`) in
`VITE_SUPABASE_ANON_KEY`. Retrieve both with:

```bash
supabase projects api-keys --project-ref xafotksnuswmmvwduzyf
```

The `sb_secret_...` key must never go in `.env.local` — Vite inlines every
`VITE_` variable into the built bundle.

## Making someone staff

`/admin` is gated on the `admins` table, which starts empty — so no one can
reach it until a row exists. There is deliberately no self-serve promotion:
a "first user becomes admin" bootstrap would hand the fulfilment view to
whoever signed in first, and Google sign-in is open.

Sign in once so the account exists, then run this in the Supabase SQL editor:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict (user_id) do nothing;
```

Sign out and back in afterwards — `is_admin()` is resolved once per session.

## Database

Migrations live in `supabase/migrations` and are applied in filename order.
Every one is written to be safe to re-run.

```bash
supabase link --project-ref xafotksnuswmmvwduzyf
supabase db push          # apply to the cloud project
```

```bash
supabase start                     # local Postgres, applies all migrations
supabase db reset                  # re-apply from scratch
```

See `docs/PLAN.md` for the phase plan.
