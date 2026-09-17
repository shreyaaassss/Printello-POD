# Printello POD — demo build plan

A demo of the seller workflow: upload artwork → configure a garment → order it
→ staff fulfil it. Scope and costing live in
`Printello_DTF/docs/pod-portal-scope.pdf`.

**Stack:** Vite + React + TypeScript + Tailwind + Supabase — matching
`printello-web`, so the canvas and DPI work lifts across directly.

Each phase ends in something demonstrable.

| Phase | Scope | Est. | State |
|-------|-------|------|-------|
| 0 | Scaffold, schema, seed catalogue | 1.5d | **done** |
| 1 | Google auth, dashboard shell, profile | 1d | **code done — blocked on Google provider** |
| 2 | Design library — upload, grid, search, DPI check | 1.5d | not started |
| 3a | Garment picker + configuration (colour, size, method) | 1.5d | not started |
| 3b | Artwork placement on canvas — drag, scale, DPI warning | 3d | not started |
| 4 | Cart + checkout + place order | 2d | not started |
| 5 | My Orders + Admin fulfilment | 2d | not started |
| 6 | Demo polish, seed history, deploy | 1.5d | not started |

## Phase 0 — what was built

- Vite + React 19 + TS + Tailwind 3 scaffold, routes stubbed for every screen
- `src/lib/supabase.ts` — PKCE client, guarded on missing env
- `src/types/catalogue.ts` — product, colour, variant, print-area types
- Migrations `0001`–`0005`, all re-runnable:
  - `0001` profiles (mirrored from `auth.users` by trigger), `admins`, `is_admin()`
  - `0002` catalogue: `products`, `product_colours`, `product_variants`,
    `print_areas`. Public read, admin write.
  - `0003` `designs` + private `designs` bucket + public `garments` bucket,
    both partitioned so the first path segment is the ownership check
  - `0004` `orders` + `order_items`. **The cart is a `draft` order**, one per
    seller, enforced by a partial unique index. Pricing is computed by a DB
    trigger, never trusted from the client, because RLS lets sellers insert
    their own line items.
  - `0005` seed: 4 garments × 6 colours × 5 sizes, with one variant
    deliberately out of stock so that state is visible in the demo

## Known placeholders

- **Garment outline images do not exist yet.** `product_colours.*_image_path`
  points at `{slug}/{colour}-{side}.svg` in the `garments` bucket; nothing is
  uploaded there. Phase 3a needs them.
- **Print-area coordinates are guesses** — a 12in × 16in box centred on a
  1000×1200 outline. They must be re-measured against the real artwork.
  Only the rows in `print_areas` change; no code depends on the values.
- Shipping is not wired. Phase 4 stubs a flat delivery charge unless
  Shiprocket credentials are available for this project.


## Phase 1 — what was built

- `features/auth/` — `AuthProvider` (session + `is_admin`), `RequireAuth`,
  `auth.ts` helpers, ported from `printello-web` along with its hard-won
  comments: `getSession()` is what consumes the `?code=` param, never await a
  Supabase call inside `onAuthStateChange` (auth-js holds a lock and re-entry
  deadlocks), and key the admin lookup on the user *id*, not the user object,
  which changes identity on every token refresh.
- `features/admin/RequireAdmin` — fails closed; RLS is the real boundary.
- `LoginPage`, `AuthCallbackPage`, a real `DashboardPage`, and `AppLayout`
  with avatar, name, sign-out and an Admin link only staff see.
- `features/profile/useProfile` — reads the row the signup trigger creates.

Verified against the cloud project: the `on_auth_user_created` trigger creates
a `profiles` row carrying `email` and `full_name` from the Google metadata.
Checked with an always-raise probe migration, so nothing persisted and the
migration history still ends at 0005.

## BLOCKED — Google sign-in is not enabled

`GET /auth/v1/settings` on `xafotksnuswmmvwduzyf` reports `google: false`;
only `email` is on. Sign-in cannot work until someone enables it:

1. **Google Cloud Console** → the *existing* Printello OAuth client (the one
   the DTF site uses) → Authorised redirect URIs → add
   `https://xafotksnuswmmvwduzyf.supabase.co/auth/v1/callback`.
   Reusing that client avoids creating and re-verifying a second OAuth app.
2. **Supabase dashboard** → Authentication → Providers → Google → enable,
   paste the same client ID and secret.
3. **Supabase dashboard** → Authentication → URL Configuration → add
   `http://localhost:5173/auth/callback` to Redirect URLs (and the deployed
   origin later).

Until then the login page renders and reports the provider error rather than
failing silently.
