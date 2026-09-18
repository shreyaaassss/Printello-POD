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

## Deploying to Cloudflare Pages

Build command `npm run build`, output directory `dist`.

`public/_redirects` gives the SPA fallback. Without it every deep link 404s on
refresh — including `/auth/callback`, so sign-in itself breaks.

**Vite inlines `VITE_*` variables at build time.** Setting them in the Pages
project is not enough on its own: an existing build keeps whatever it was
compiled with, so the deployment must be **retried** after the variables are
set. The symptom is a site that loads but reports sign-in unavailable. Verify
by fetching the deployed bundle and grepping for the Supabase project ref.

Add the deployed origin to **Supabase → Authentication → URL Configuration**
(both the site URL and `https://<origin>/auth/callback` as a redirect URL), and
to the Google OAuth client's authorised origins. Sign-in will fail on the
deployed site until both are done, while still working on localhost.

## Garment artwork

The built-in shapes in `GarmentOutline.tsx` are a stand-in. To use real flat
tech-pack sketches instead, upload them to the public `garments` bucket and
point the colour rows at them — **no code change is needed**:

```sql
update public.product_colours pc
set front_image_path = p.slug || '/' || lower(replace(pc.name,' ','-')) || '-front.png',
    back_image_path  = p.slug || '/' || lower(replace(pc.name,' ','-')) || '-back.png'
from public.products p
where p.id = pc.product_id and p.slug = 'regular-tshirt';
```

`GarmentPreview` renders the image whenever a path is set and falls back to
the drawn shape when it is null.

**Two requirements on the files.** They must be exported at the aspect ratio
recorded in `print_areas.image_width/image_height` (currently 1000×1200), or
the print rectangle will drift against the garment. And the print-area
coordinates must be re-measured against the new artwork — they are the one
thing no fallback covers, because artwork positioned against a wrong rectangle
prints in the wrong place.

## Demo data

`scripts/seed-demo-orders.sql` creates four orders spread across the lifecycle
so the dashboard, My Orders and the admin queue are not empty. Edit the email
at the top and run it in the SQL editor. It requires a staff account, because
advancing an order past `placed` goes through `is_admin()` — the script walks
each order forward one legal step at a time rather than writing the end state,
so it exercises the same rules a real order does.

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
