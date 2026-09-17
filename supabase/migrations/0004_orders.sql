-- Phase 0: orders and their line items. The cart is not a separate table —
-- it is the single 'draft' order a seller is allowed to have open at a time.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft'
    check (status in (
      'draft', 'placed', 'in_production', 'shipped', 'delivered',
      'cancelled', 'rejected', 'returned'
    )),
  -- Human-readable reference, assigned when the draft is placed.
  reference text unique,

  -- Delivery details, captured at checkout.
  contact_name text,
  contact_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,

  items_total numeric(10, 2) not null default 0,
  shipping_total numeric(10, 2) not null default 0,
  grand_total numeric(10, 2) not null default 0,

  -- Fulfilment, written by staff from the admin screen.
  courier text,
  awb text,
  tracking_url text,
  staff_note text,

  placed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open cart per seller. Placed orders are unconstrained.
create unique index if not exists orders_one_draft_per_user
  on public.orders (user_id) where status = 'draft';

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

create index if not exists orders_status_idx
  on public.orders (status, created_at desc);

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  colour_id uuid not null references public.product_colours (id),
  variant_id uuid not null references public.product_variants (id),
  design_id uuid references public.designs (id) on delete set null,

  custom_name text,
  size text not null,
  print_method text not null check (print_method in ('DTF', 'DTG')),
  side text not null default 'front' check (side in ('front', 'back')),

  -- Where the artwork sits inside the print area, as fractions of that area:
  -- { x, y, scale, rotation }. Fractions rather than pixels so the same record
  -- renders correctly at any preview size and at print resolution.
  placement jsonb not null default '{"x":0,"y":0,"scale":1,"rotation":0}'::jsonb,

  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10, 2) not null default 0,
  line_total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Pricing is computed in the database, never trusted from the client: RLS lets
-- a seller insert their own line items, so a browser-set price would be a hole.
-- ---------------------------------------------------------------------------

create or replace function public.price_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base numeric(10, 2);
  delta numeric(10, 2);
begin
  select p.base_price into base
  from public.products p
  where p.id = new.product_id;

  select v.price_delta into delta
  from public.product_variants v
  where v.id = new.variant_id;

  if base is null then
    raise exception 'Unknown product %', new.product_id;
  end if;

  new.unit_price := base + coalesce(delta, 0);
  new.line_total := new.unit_price * new.quantity;
  return new;
end;
$$;

drop trigger if exists order_items_price on public.order_items;
create trigger order_items_price
  before insert or update of product_id, variant_id, quantity on public.order_items
  for each row execute function public.price_order_item();

-- Keep the order's totals in step with its lines.
create or replace function public.recalc_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.order_id, old.order_id);
  items numeric(10, 2);
begin
  select coalesce(sum(line_total), 0) into items
  from public.order_items
  where order_id = target;

  update public.orders
  set items_total = items,
      grand_total = items + coalesce(shipping_total, 0)
  where id = target;

  return null;
end;
$$;

drop trigger if exists order_items_recalc on public.order_items;
create trigger order_items_recalc
  after insert or update or delete on public.order_items
  for each row execute function public.recalc_order_totals();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

-- A seller may edit their own order; admins may advance any order.
drop policy if exists "orders_update_own" on public.orders;
create policy "orders_update_own" on public.orders
  for update using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- Only a draft may be deleted — an placed order is a business record.
drop policy if exists "orders_delete_draft" on public.orders;
create policy "orders_delete_draft" on public.orders
  for delete using (auth.uid() = user_id and status = 'draft');

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

-- Lines may only be added to or changed on a draft the caller owns. This is
-- what stops a seller editing an order after it has gone to production.
drop policy if exists "order_items_write_own_draft" on public.order_items;
create policy "order_items_write_own_draft" on public.order_items
  for all using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid() and o.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid() and o.status = 'draft'
    )
  );
