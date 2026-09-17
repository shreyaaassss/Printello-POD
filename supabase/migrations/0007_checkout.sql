-- Phase 4: turning a draft cart into a placed order.
--
-- Shipping, the order reference and the placed timestamp are all decided in
-- the database. RLS lets a seller update their own order row, so anything the
-- browser were trusted with here — the delivery charge above all — would be a
-- hole of exactly the same shape as a client-supplied unit price.

create sequence if not exists public.order_reference_seq;

-- Flat-rate delivery for the demo. A real rate comes from the courier's
-- quote API; this is deliberately one obvious constant rather than a fake
-- rate card that would look authoritative and be wrong.
create or replace function public.delivery_charge(items_total numeric)
returns numeric
language sql
immutable
as $$
  select case when coalesce(items_total, 0) >= 999 then 0::numeric else 79::numeric end;
$$;

/**
 * Keeps an order's money and lifecycle fields honest on every write.
 *
 * Runs BEFORE UPDATE so the corrected values are what get stored, rather than
 * being patched afterwards where a concurrent read could see the client's.
 */
create or replace function public.enforce_order_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_items int;
begin
  -- Delivery is computed, never accepted.
  new.shipping_total := public.delivery_charge(new.items_total);
  new.grand_total := coalesce(new.items_total, 0) + new.shipping_total;

  if new.status = 'placed' and coalesce(old.status, '') = 'draft' then
    select count(*) into n_items from public.order_items where order_id = new.id;
    if n_items = 0 then
      raise exception 'Cannot place an empty order' using errcode = 'check_violation';
    end if;

    if coalesce(trim(new.contact_name), '') = ''
       or coalesce(trim(new.contact_phone), '') = ''
       or coalesce(trim(new.address_line1), '') = ''
       or coalesce(trim(new.city), '') = ''
       or coalesce(trim(new.state), '') = ''
       or coalesce(trim(new.pincode), '') = '' then
      raise exception 'Delivery details are incomplete' using errcode = 'check_violation';
    end if;

    -- Assigned here so a reference is never burned by an abandoned cart.
    if new.reference is null then
      new.reference := 'PD' || to_char(nextval('public.order_reference_seq'), 'FM000000');
    end if;
    new.placed_at := coalesce(new.placed_at, now());
  end if;

  -- A seller may not walk an order backwards, or reprice it by editing
  -- totals directly; only staff move an order on from 'placed'.
  if old.status <> new.status
     and old.status <> 'draft'
     and not public.is_admin() then
    raise exception 'Only staff can change the status of a placed order'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enforce_rules on public.orders;
create trigger orders_enforce_rules
  before update on public.orders
  for each row execute function public.enforce_order_rules();

-- The line-item trigger writes items_total directly, which bypasses the
-- BEFORE UPDATE hook above on its own UPDATE. Recompute there too so a cart's
-- delivery charge tracks its contents.
create or replace function public.recalc_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.order_id, old.order_id);
  items numeric(10, 2);
  ship numeric(10, 2);
begin
  select coalesce(sum(line_total), 0) into items
  from public.order_items
  where order_id = target;

  ship := public.delivery_charge(items);

  update public.orders
  set items_total = items,
      shipping_total = ship,
      grand_total = items + ship
  where id = target;

  return null;
end;
$$;
