-- Phase 0: the garment catalogue — products, colours, sellable variants and
-- the printable area on each face. Readable by everyone, writable by admins.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  gsm integer,
  description text,
  base_price numeric(10, 2) not null default 0,
  -- Which print methods this garment supports, e.g. {DTF,DTG}.
  print_methods text[] not null default '{DTF,DTG}',
  -- [{ size, chestIn, lengthIn }, ...] shown in the size accordion.
  size_chart jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_active_sort_idx
  on public.products (active, sort_order);

create table if not exists public.product_colours (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  hex text not null,
  -- Storage paths of the flat outline rendered in this colour.
  front_image_path text,
  back_image_path text,
  sort_order integer not null default 0,
  unique (product_id, name)
);

create index if not exists product_colours_product_idx
  on public.product_colours (product_id, sort_order);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  colour_id uuid not null references public.product_colours (id) on delete cascade,
  size text not null check (size in ('S', 'M', 'L', 'XL', '2XL')),
  -- Added to the product's base price; 2XL typically carries a surcharge.
  price_delta numeric(10, 2) not null default 0,
  in_stock boolean not null default true,
  unique (colour_id, size)
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id);

-- The printable rectangle on one face, in the pixel coordinate space of that
-- face's outline image. image_width/height record which image the numbers
-- refer to, so the canvas can scale them to any rendered size. width_in and
-- height_in give the real-world print size, which is what the DPI check needs.
create table if not exists public.print_areas (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  side text not null check (side in ('front', 'back')),
  image_width integer not null,
  image_height integer not null,
  x integer not null,
  y integer not null,
  width integer not null,
  height integer not null,
  width_in numeric(6, 2) not null,
  height_in numeric(6, 2) not null,
  unique (product_id, side)
);

-- ---------------------------------------------------------------------------
-- RLS: the catalogue is public reference data. Only admins may change it.
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.product_colours enable row level security;
alter table public.product_variants enable row level security;
alter table public.print_areas enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['products', 'product_colours', 'product_variants', 'print_areas']
  loop
    execute format('drop policy if exists "%1$s_select_all" on public.%1$I', t);
    execute format(
      'create policy "%1$s_select_all" on public.%1$I for select using (true)', t
    );

    execute format('drop policy if exists "%1$s_write_admin" on public.%1$I', t);
    execute format(
      'create policy "%1$s_write_admin" on public.%1$I for all
         using (public.is_admin()) with check (public.is_admin())', t
    );
  end loop;
end;
$$;
