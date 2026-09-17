-- An empty cart was carrying the flat delivery charge, so a cart with nothing
-- in it read as items 0 / delivery 79 / total 79. It could never be placed —
-- enforce_order_rules rejects an empty order — but the row is wrong, and an
-- admin list or invoice reading it would show a ₹79 order for no goods.
create or replace function public.delivery_charge(items_total numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(items_total, 0) <= 0 then 0::numeric   -- nothing to deliver
    when items_total >= 999 then 0::numeric              -- free over the threshold
    else 79::numeric
  end;
$$;

-- Re-settle any carts already holding the wrong figure.
update public.orders
set shipping_total = public.delivery_charge(items_total),
    grand_total = coalesce(items_total, 0) + public.delivery_charge(items_total)
where status = 'draft';
