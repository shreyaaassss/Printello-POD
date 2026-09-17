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
| 1 | Google auth, dashboard shell, profile | 1d | **done** (Google enabled 2026-09-18) |
| 2 | Design library — upload, grid, search, DPI check | 1.5d | **done** |
| 3a | Garment picker + configuration (colour, size, method) | 1.5d | **done** |
| 3b | Artwork placement on canvas — drag, scale, DPI warning | 3d | **done** |
| 4 | Cart + checkout + place order | 2d | **done** |
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

**Resolved 2026-09-18** — `/auth/v1/settings` now reports `google: true`.

## Phase 2 — what was built

- `lib/imageProbe.ts` — decodes the file (which is also what rejects a
  non-image named `.png`), measures pixels, and samples the alpha channel.
- `features/designs/designs.ts` — upload, list, rename, delete, batch signed
  thumbnail URLs. Storage first then row, with cleanup on insert failure: an
  orphaned object is invisible, an orphaned row is a broken thumbnail.
- `DesignsPage` — drag-and-drop or picker, multi-file, search, delete,
  chequerboard tiles so transparency is visible rather than assumed.

**The transparency check is the point.** The DTF DPI notes call out that a file
with no alpha channel prints a white box around the artwork, and that a
resolution warning cannot catch it. JPEGs never carry alpha, and the library
accepts JPEG, so every upload is sampled and an opaque file is flagged at
upload time — when it is still cheap to re-export. Resolution is reported as
"sharp up to N inches" rather than a DPI number, because DPI is meaningless
until the print area is known; the real DPI check belongs in phase 3b.

## Verified against the cloud project

Probe migrations, always-raise so nothing persists and none were recorded —
history still ends at 0005:

- seller A sees only their own design (1 of 2) and none of B's orders
- A cannot file a design under B's user id (42501)
- A cannot reprice the catalogue (0 rows) or make themselves an admin (42501)
- A sees only their own storage objects, and cannot write into B's folder
- buckets are correct: `designs` private, `garments` public

One trap worth recording: inside a probe, `reset role` drops to the session
role `cli_login_postgres`, which has no rights — `db push` runs as `postgres`.
Use `set local role postgres` instead. Also, Supabase blocks direct DELETE on
storage tables, so deletion cannot be asserted this way.


## Phase 3a — what was built

- `features/catalogue/catalogue.ts` — product list and a single-round-trip
  `getProductDetail` (product + colours + variants + print areas).
- `CreateProductPage` — garment grid with "from" pricing.
- `CustomizePage` — garment switcher, colour swatches, sizes with per-colour
  stock, size chart, print method, front/back, live price.
- `GarmentPreview` — outline plus the printable rectangle, both on the same
  1000x1200 viewBox so the box lands correctly at any rendered size. It already
  takes `children`, clipped to the print area, which is where phase 3b puts
  the artwork.
- `/__garments` — a **dev-only** route rendering every shape and colour.
  Excluded from builds via `import.meta.env.DEV`; verified absent from `dist/`.

### Four bugs the visual check found that type-checking could not

1. **The hoodie had no hood.** The arc is drawn above the shoulders, against
   the page rather than the garment, and its stroke was chosen for contrast
   with the *fill* — so it was invisible. Silhouette strokes now use one
   neutral grey, because that edge borders the page, not the garment.
2. **Sweatshirt and hoodie were indistinguishable** from the tee and each
   other. Long sleeves now run to a cuff, with hem ribbing, drawstrings and a
   pocket as the distinguishing cues.
3. **Grey Melange lost all its detailing.** It sits just over the lightness
   threshold, so the fixed light-grey detail stroke resolved to exactly the
   fill colour. Detail strokes are now derived from the garment colour by
   mixing toward black or white, which cannot collide by construction.
4. **The hoodie print area ran across the kangaroo pocket** — unprintable.
   Fixed in migration `0006`; the tee and the hoodie back are untouched.

Numbers 1–3 were invisible to `tsc` and would have shown up first in front of
the manager. The dev route exists so that cannot happen again.

### Still placeholder

Print-area geometry remains guessed. `0006` is a correction to a guess, not a
measurement. Real tech packs are still needed — see the parallel workstream.


## Phase 3b — what was built

- `features/customize/placement.ts` — the geometry, as pure functions. Every
  value is a **fraction of the print area**, never pixels or inches, so one
  stored placement renders identically in a 300px preview and a 4000px print
  file, and survives the print-area geometry changing (which it will, since it
  is still placeholder).
- `ArtworkStage` — pointer drag converted to print-area fractions and clamped
  on every frame. **Containment is enforced by construction**: `maxScale` caps
  the design at what fits and `clampPlacement` keeps it inside, so artwork
  that overhangs the printable region is not a validation error, it is simply
  unreachable.
- `DesignPicker` — modal over the seller's library.
- `features/cart/cart.ts` — `getOrCreateDraftOrder` + `addToCart`. Sends no
  price: the `price_order_item` trigger computes it. A 23505 on draft creation
  is treated as two tabs racing and re-read, since the partial unique index is
  the real guarantee.
- Live DPI against the *current* scale, with the warning wording the DTF
  policy settled on — "soft", paired with "blurred or pixelated", and explicit
  that it cannot be corrected during printing. It warns, never blocks. Unlike
  the ready-made sheet case, "scale it down" **is** actionable here, so the
  copy offers it.

### Verification

`scripts/check-placement.mts` — 22 checks against the real module (Node 26 runs
TypeScript directly, so this imports `src/` rather than reimplementing it).
Covers which axis limits the fit, containment after an extreme drag, the
collapse-to-a-point case when a design exactly fills an axis, scale capping,
idempotence of clamping, and the DPI relationship. One failure it produced was
in the *test's* arithmetic: `maxScale` caps at 1 because a design must never
exceed the print area's width, so the hoodie's 400/380 is still width-limited.

A cart probe against the cloud project, run as the seller rather than as owner,
confirmed: the draft cart is created, a second draft is blocked, `unit_price`
comes out at 289 (249 + 40 for 2XL) from the trigger and not from the client,
totals roll up, the placement JSON round-trips exactly, and line items cannot
be edited once the order leaves draft.

`/__garments` now also renders four placement cases. Verified absent from
`dist/`.


## Phase 4 — what was built

- Migration `0007` — `enforce_order_rules`, a BEFORE UPDATE trigger on
  `orders`. **Delivery, the reference, the timestamp and every total are
  decided in the database.** RLS lets a seller update their own order row, so
  a client-supplied delivery charge would be a hole of exactly the same shape
  as a client-supplied unit price. It also refuses an empty order or an
  incomplete address, and stops a seller advancing their own order past
  `placed`.
- Migration `0008` — an empty cart no longer carries the flat delivery charge.
- `CartPage` — lines with artwork thumbnails, quantity editing, removal, and a
  summary. Quantity updates send only `quantity`; the pricing trigger
  recomputes the line.
- `CheckoutPage` — delivery form prefilled once from the profile, PIN lookup
  filling city and state, order placement, and a confirmation showing the
  reference.
- `pincodeLookup.ts` ported from `printello-web` — India Post, no key, and it
  sends `access-control-allow-origin: *` (re-confirmed against the live API).

`placeOrder` sends only the delivery details and the status. Everything else
is the database's, so the client cannot place something invalid by getting its
own validation wrong.

### Verification

Probes run **as the seller**, not as owner, against the cloud project:

- an empty cart is refused (23514), and so is an incomplete address
- a seller setting `shipping_total = 0` is overwritten back to 79
- a complete order places, gets reference `PD…` and a `placed_at`
- a seller **cannot** advance their own order to `shipped` (42501)
- quantity 2 → 5 reprices the line to 1245 and drops delivery to 0 at the
  threshold; back to 1 restores the 79
- removing the last line returns the cart to 0 / 0 / 0

The embedded PostgREST select behind `getCart` was checked against the live
API: it returns 200, while a deliberately wrong embed returns PGRST200/400 —
so the check distinguishes a working join from a silent empty result.

### Still stubbed

Delivery is a flat ₹79, free over ₹999, computed by `delivery_charge()`. This
project has no Shiprocket credentials, and one obvious constant is better than
a fake rate card that would look authoritative and be wrong. Swapping it for a
live quote is a change to that one function.
