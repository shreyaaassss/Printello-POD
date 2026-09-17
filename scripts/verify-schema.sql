-- Phase 0 verification. Run against a database with migrations 0001-0005
-- applied:  psql "$DB_URL" -f scripts/verify-schema.sql
--
-- Everything happens inside a transaction that is rolled back, so this is
-- safe to run against any environment: it writes nothing.

begin;

do $$
declare
  n_products int;
  n_colours int;
  n_variants int;
  n_oos int;
  n_areas int;
  uid uuid := gen_random_uuid();
  oid uuid;
  v record;
  got_unit numeric;
  got_line numeric;
  got_total numeric;
  expected_unit numeric;
  failures text[] := '{}';
begin
  -- ---- catalogue seed ----------------------------------------------------
  select count(*) into n_products from public.products;
  select count(*) into n_colours from public.product_colours;
  select count(*) into n_variants from public.product_variants;
  select count(*) into n_oos from public.product_variants where not in_stock;
  select count(*) into n_areas from public.print_areas;

  if n_products <> 4 then
    failures := failures || format('products: expected 4, got %s', n_products);
  end if;
  if n_colours <> 24 then
    failures := failures || format('colours: expected 24 (4x6), got %s', n_colours);
  end if;
  if n_variants <> 120 then
    failures := failures || format('variants: expected 120 (4x6x5), got %s', n_variants);
  end if;
  if n_oos <> 1 then
    failures := failures || format('out-of-stock: expected exactly 1, got %s', n_oos);
  end if;
  if n_areas <> 8 then
    failures := failures || format('print_areas: expected 8 (4x2), got %s', n_areas);
  end if;

  -- ---- pricing trigger ---------------------------------------------------
  -- A 2XL carries a +40 delta, so it is the case worth checking.
  select v2.id, v2.product_id, v2.colour_id, v2.size,
         p.base_price + v2.price_delta as expect
    into v
  from public.product_variants v2
  join public.products p on p.id = v2.product_id
  where p.slug = 'regular-tshirt' and v2.size = '2XL'
  limit 1;

  expected_unit := v.expect;

  insert into auth.users (id, instance_id, aud, role, email)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'verify-' || uid || '@example.test');

  insert into public.orders (user_id, status) values (uid, 'draft')
  returning id into oid;

  -- unit_price and line_total must come from the trigger, not from these values.
  insert into public.order_items
    (order_id, product_id, colour_id, variant_id, size, print_method, quantity,
     unit_price, line_total)
  values (oid, v.product_id, v.colour_id, v.id, v.size, 'DTF', 3, 999999, 999999);

  select unit_price, line_total into got_unit, got_line
  from public.order_items where order_id = oid;

  select items_total into got_total from public.orders where id = oid;

  if got_unit <> expected_unit then
    failures := failures || format(
      'unit_price: expected %s (base+delta), got %s — client value was not overridden',
      expected_unit, got_unit);
  end if;
  if got_line <> expected_unit * 3 then
    failures := failures || format('line_total: expected %s, got %s',
      expected_unit * 3, got_line);
  end if;
  if got_total <> expected_unit * 3 then
    failures := failures || format(
      'orders.items_total: expected %s, got %s — recalc trigger did not fire',
      expected_unit * 3, got_total);
  end if;

  -- ---- one draft per seller ----------------------------------------------
  begin
    insert into public.orders (user_id, status) values (uid, 'draft');
    failures := failures || 'second draft order was allowed — partial unique index missing';
  exception when unique_violation then
    null;  -- expected
  end;

  -- ---- report ------------------------------------------------------------
  if array_length(failures, 1) is null then
    raise notice 'PASS — catalogue seeded, pricing enforced, one draft per seller';
  else
    raise exception E'FAILED:\n  %', array_to_string(failures, E'\n  ');
  end if;
end;
$$;

rollback;
