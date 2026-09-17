-- The hoodie front print area overlapped the kangaroo pocket, which cannot be
-- printed across. Raise it to finish above the pocket seam (pocket top sits at
-- y=820 in the 1000x1200 outline space).
--
-- Still placeholder geometry: replace with measured values when the real
-- tech packs arrive. Only these rows change — no code depends on the numbers.
update public.print_areas pa
set y = 380,
    height = 400,
    height_in = 12.6
from public.products p
where p.id = pa.product_id
  and p.slug = 'oversized-hoodie'
  and pa.side = 'front';
