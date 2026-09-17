-- Demo history: four orders spread across the lifecycle, so the dashboard,
-- My Orders and the admin queue all have something in them.
--
-- Run in the Supabase SQL editor AFTER:
--   1. signing in once, so the account exists, and
--   2. promoting that account to staff (see README) — advancing an order past
--      'placed' goes through is_admin(), so the script acts as that user.
--
-- Edit the email on the next line. Re-running adds four more orders; it does
-- not clear previous ones.


do $$
declare
  target_email text := 'you@example.com';  -- <<< EDIT ME
  uid uuid;
  oid uuid;
  did uuid;
  v record;
  spec record;
begin
  select id into uid from auth.users where email = target_email;
  if uid is null then
    raise exception 'No account for %. Sign in once first.', target_email;
  end if;

  -- The script advances orders through the workflow, which only staff may do.
  if not exists (select 1 from public.admins where user_id = uid) then
    raise exception
      'Promote % to staff first (see README), otherwise these orders cannot be advanced.',
      target_email;
  end if;

  -- Act as that user for everything below, so both RLS and is_admin() see them.
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  -- Reuse their own artwork when they have some; otherwise leave it unset
  -- rather than inventing a design row pointing at a file that isn't there.
  select id into did from public.designs where user_id = uid order by created_at limit 1;

  for spec in
    select * from (values
      ('delivered',     'regular-tshirt',  'Black',        'L',   2, 34),
      ('shipped',       'oversized-hoodie','Bottle Green', 'XL',  1, 12),
      ('in_production', 'sweatshirt',      'Navy',         'M',   4,  5),
      ('placed',        'oversized-tshirt','White',        '2XL', 3,  1)
    ) as t(target_status, slug, colour, size, qty, days_ago)
  loop
    select pv.id as variant_id, pv.product_id, pv.colour_id
      into v
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    join public.product_colours pc on pc.id = pv.colour_id
    where p.slug = spec.slug and pc.name = spec.colour and pv.size = spec.size
      and pv.in_stock
    limit 1;

    if v.variant_id is null then
      raise notice 'Skipping % / % / % — not stocked', spec.slug, spec.colour, spec.size;
      continue;
    end if;

    -- A draft first: the reference and placed_at are assigned on the
    -- transition, not on insert, so seeding has to go the same way a real
    -- order does. That also means this exercises the real rules.
    insert into public.orders (user_id, status)
    values (uid, 'draft')
    on conflict do nothing
    returning id into oid;

    if oid is null then
      raise exception 'A draft cart already exists. Empty or place it, then re-run.';
    end if;

    insert into public.order_items
      (order_id, product_id, colour_id, variant_id, design_id, size, print_method,
       side, placement, quantity, custom_name)
    values (oid, v.product_id, v.colour_id, v.variant_id, did, spec.size, 'DTF', 'front',
            '{"x":0.5,"y":0.45,"scale":0.72,"rotation":0}'::jsonb, spec.qty,
            initcap(replace(spec.slug, '-', ' ')));

    update public.orders set
      status = 'placed',
      contact_name = 'Demo Customer',
      contact_phone = '9876543210',
      address_line1 = 'Shop 4, Kalpataru Estate',
      address_line2 = 'Manorama Nagar',
      city = 'Thane', state = 'Maharashtra', pincode = '400607',
      placed_at = now() - make_interval(days => spec.days_ago),
      created_at = now() - make_interval(days => spec.days_ago)
    where id = oid;

    -- Walk it forward one legal step at a time; 0009 refuses shortcuts.
    if spec.target_status in ('in_production', 'shipped', 'delivered') then
      update public.orders set status = 'in_production' where id = oid;
    end if;
    if spec.target_status in ('shipped', 'delivered') then
      update public.orders set status = 'shipped',
        courier = 'Delhivery',
        awb = 'AWB' || lpad((random() * 99999999)::int::text, 8, '0'),
        tracking_url = 'https://www.delhivery.com/track'
      where id = oid;
    end if;
    if spec.target_status = 'delivered' then
      update public.orders set status = 'delivered' where id = oid;
    end if;

    oid := null;
  end loop;

  raise notice 'Seeded demo orders for %', target_email;
end;
$$;
