-- Phase 0: demo catalogue — four garments, six colours each, five sizes.
-- Re-runnable: every insert upserts on its natural key.
--
-- The print_area coordinates below are PLACEHOLDERS sized against a 1000x1200
-- outline image. Replace them, and the image paths, once the real flat
-- outlines land. Nothing else in the app needs to change when they do.

insert into public.products
  (slug, name, gsm, description, base_price, print_methods, size_chart, sort_order)
values
  (
    'regular-tshirt', 'Regular T-Shirt', 180,
    'Classic-fit 180 GSM combed cotton tee.', 249, '{DTF,DTG}',
    '[{"size":"S","chestIn":36,"lengthIn":26},{"size":"M","chestIn":38,"lengthIn":27},
      {"size":"L","chestIn":40,"lengthIn":28},{"size":"XL","chestIn":42,"lengthIn":29},
      {"size":"2XL","chestIn":44,"lengthIn":30}]'::jsonb,
    1
  ),
  (
    'oversized-tshirt', 'Oversized T-Shirt', 240,
    'Drop-shoulder 240 GSM oversized tee.', 399, '{DTF,DTG}',
    '[{"size":"S","chestIn":40,"lengthIn":27},{"size":"M","chestIn":42,"lengthIn":28},
      {"size":"L","chestIn":44,"lengthIn":29},{"size":"XL","chestIn":46,"lengthIn":30},
      {"size":"2XL","chestIn":48,"lengthIn":31}]'::jsonb,
    2
  ),
  (
    'oversized-hoodie', 'Oversized Hoodie', 320,
    '320 GSM fleece hoodie with kangaroo pocket.', 899, '{DTF}',
    '[{"size":"S","chestIn":42,"lengthIn":27},{"size":"M","chestIn":44,"lengthIn":28},
      {"size":"L","chestIn":46,"lengthIn":29},{"size":"XL","chestIn":48,"lengthIn":30},
      {"size":"2XL","chestIn":50,"lengthIn":31}]'::jsonb,
    3
  ),
  (
    'sweatshirt', 'Sweatshirt', 320,
    '320 GSM fleece crew-neck sweatshirt.', 749, '{DTF}',
    '[{"size":"S","chestIn":40,"lengthIn":26},{"size":"M","chestIn":42,"lengthIn":27},
      {"size":"L","chestIn":44,"lengthIn":28},{"size":"XL","chestIn":46,"lengthIn":29},
      {"size":"2XL","chestIn":48,"lengthIn":30}]'::jsonb,
    4
  )
on conflict (slug) do update set
  name = excluded.name,
  gsm = excluded.gsm,
  description = excluded.description,
  base_price = excluded.base_price,
  print_methods = excluded.print_methods,
  size_chart = excluded.size_chart,
  sort_order = excluded.sort_order;

-- Colours, variants and print areas for every seeded product.
do $$
declare
  prod record;
  col record;
  v_colour_id uuid;
  sz text;
  colours constant jsonb := '[
    {"name":"White","hex":"#FFFFFF","sort":1},
    {"name":"Black","hex":"#111111","sort":2},
    {"name":"Navy","hex":"#1B2A4A","sort":3},
    {"name":"Red","hex":"#C8102E","sort":4},
    {"name":"Bottle Green","hex":"#0B6B3A","sort":5},
    {"name":"Grey Melange","hex":"#9AA0A6","sort":6}
  ]'::jsonb;
begin
  for prod in
    select id, slug from public.products
    where slug in ('regular-tshirt', 'oversized-tshirt', 'oversized-hoodie', 'sweatshirt')
  loop
    for col in select * from jsonb_array_elements(colours) as value loop
      -- Image paths stay NULL until real outlines are uploaded to the
      -- 'garments' bucket. The UI draws a built-in outline tinted with `hex`
      -- whenever a path is null, so a missing asset degrades to a placeholder
      -- rather than a broken image. Do not seed paths to files that don't exist.
      insert into public.product_colours
        (product_id, name, hex, sort_order)
      values (
        prod.id,
        col.value ->> 'name',
        col.value ->> 'hex',
        (col.value ->> 'sort')::int
      )
      on conflict (product_id, name) do update set
        hex = excluded.hex,
        sort_order = excluded.sort_order
      returning id into v_colour_id;

      foreach sz in array array['S', 'M', 'L', 'XL', '2XL'] loop
        insert into public.product_variants
          (product_id, colour_id, size, price_delta, in_stock)
        values (
          prod.id,
          v_colour_id,
          sz,
          case when sz = '2XL' then 40 else 0 end,
          -- One deliberate gap so the out-of-stock state is visible in the demo.
          not (prod.slug = 'regular-tshirt' and col.value ->> 'name' = 'White' and sz = 'S')
        )
        on conflict (colour_id, size) do update set
          price_delta = excluded.price_delta,
          in_stock = excluded.in_stock;
      end loop;
    end loop;

    -- 12in x 16in printable area, centred on the chest of a 1000x1200 outline.
    insert into public.print_areas
      (product_id, side, image_width, image_height, x, y, width, height, width_in, height_in)
    values
      (prod.id, 'front', 1000, 1200, 310, 420, 380, 507, 12, 16),
      (prod.id, 'back',  1000, 1200, 310, 400, 380, 507, 12, 16)
    on conflict (product_id, side) do update set
      image_width = excluded.image_width,
      image_height = excluded.image_height,
      x = excluded.x,
      y = excluded.y,
      width = excluded.width,
      height = excluded.height,
      width_in = excluded.width_in,
      height_in = excluded.height_in;
  end loop;
end;
$$;
