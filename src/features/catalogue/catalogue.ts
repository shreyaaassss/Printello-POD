import { supabase } from '../../lib/supabase';
import type {
  PrintArea,
  PrintMethod,
  PrintSide,
  Product,
  ProductColour,
  ProductVariant,
  SizeChartRow,
  SizeCode,
} from '../../types/catalogue';

/** Display order for sizes, independent of whatever order the rows arrive in. */
export const SIZE_ORDER: SizeCode[] = ['S', 'M', 'L', 'XL', '2XL'];

/** Everything the Customize screen needs for one garment, in one round trip. */
export interface ProductDetail {
  product: Product;
  colours: ProductColour[];
  variants: ProductVariant[];
  printAreas: Record<PrintSide, PrintArea | null>;
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, name, gsm, description, base_price, print_methods, size_chart, sort_order')
    .eq('active', true)
    .order('sort_order');

  if (error) throw new Error(error.message);
  return (data ?? []).map(toProduct);
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const { data: productRow, error: productErr } = await supabase
    .from('products')
    .select('id, slug, name, gsm, description, base_price, print_methods, size_chart, sort_order')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (productErr) throw new Error(productErr.message);
  if (!productRow) return null;

  const product = toProduct(productRow);

  const [coloursRes, variantsRes, areasRes] = await Promise.all([
    supabase
      .from('product_colours')
      .select('id, product_id, name, hex, front_image_path, back_image_path, sort_order')
      .eq('product_id', product.id)
      .order('sort_order'),
    supabase
      .from('product_variants')
      .select('id, product_id, colour_id, size, price_delta, in_stock')
      .eq('product_id', product.id),
    supabase
      .from('print_areas')
      .select(
        'id, product_id, side, image_width, image_height, x, y, width, height, width_in, height_in',
      )
      .eq('product_id', product.id),
  ]);

  for (const res of [coloursRes, variantsRes, areasRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const printAreas: Record<PrintSide, PrintArea | null> = { front: null, back: null };
  for (const row of areasRes.data ?? []) {
    printAreas[row.side as PrintSide] = {
      id: row.id,
      productId: row.product_id,
      side: row.side as PrintSide,
      imageWidth: row.image_width,
      imageHeight: row.image_height,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      widthIn: Number(row.width_in),
      heightIn: Number(row.height_in),
    };
  }

  return {
    product,
    colours: (coloursRes.data ?? []).map((c) => ({
      id: c.id,
      productId: c.product_id,
      name: c.name,
      hex: c.hex,
      frontImagePath: c.front_image_path,
      backImagePath: c.back_image_path,
      sortOrder: c.sort_order,
    })),
    variants: (variantsRes.data ?? []).map((v) => ({
      id: v.id,
      productId: v.product_id,
      colourId: v.colour_id,
      size: v.size as SizeCode,
      priceDelta: Number(v.price_delta),
      inStock: v.in_stock,
    })),
    printAreas,
  };
}

/** The variant for one colour + size, or undefined if the combination isn't stocked. */
export function findVariant(
  variants: ProductVariant[],
  colourId: string,
  size: SizeCode,
): ProductVariant | undefined {
  return variants.find((v) => v.colourId === colourId && v.size === size);
}

/**
 * Price shown to the seller. Mirrors the `price_order_item` trigger — which is
 * the authority. If these ever disagree, the trigger wins and the cart total
 * will differ from the preview, so they must be changed together.
 */
export function unitPrice(product: Product, variant: ProductVariant | undefined): number {
  return product.basePrice + (variant?.priceDelta ?? 0);
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function toProduct(row: {
  id: string;
  slug: string;
  name: string;
  gsm: number | null;
  description: string | null;
  base_price: number | string;
  print_methods: string[] | null;
  size_chart: unknown;
  sort_order: number;
}): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    gsm: row.gsm,
    description: row.description,
    basePrice: Number(row.base_price),
    printMethods: (row.print_methods ?? ['DTF']) as PrintMethod[],
    sizeChart: (row.size_chart as SizeChartRow[] | null) ?? null,
    sortOrder: row.sort_order,
  };
}
