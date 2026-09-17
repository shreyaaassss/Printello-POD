import { supabase } from '../../lib/supabase';
import type { Placement } from '../customize/placement';
import type { PrintMethod, PrintSide, SizeCode } from '../../types/catalogue';

export interface AddToCartInput {
  productId: string;
  colourId: string;
  variantId: string;
  designId: string;
  size: SizeCode;
  printMethod: PrintMethod;
  side: PrintSide;
  placement: Placement;
  quantity: number;
  customName: string | null;
}

/**
 * The seller's open cart, created on first use.
 *
 * The cart is not its own table: it is the one order per seller allowed to sit
 * in `draft`, enforced by a partial unique index. Checkout is then a status
 * change rather than moving rows between tables.
 */
export async function getOrCreateDraftOrder(userId: string): Promise<string> {
  const { data: existing, error: selectErr } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .maybeSingle();

  if (selectErr) throw new Error(selectErr.message);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('orders')
    .insert({ user_id: userId, status: 'draft' })
    .select('id')
    .single();

  if (error) {
    // Two tabs can race here. The unique index is what actually guarantees one
    // draft, so on a conflict re-read rather than surfacing an error.
    if (error.code === '23505') {
      const { data: raced } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'draft')
        .maybeSingle();
      if (raced) return raced.id;
    }
    throw new Error(error.message);
  }
  return data.id;
}

/**
 * Add one configured product to the cart.
 *
 * `unit_price` and `line_total` are deliberately not sent: the
 * `price_order_item` trigger computes them from the catalogue. RLS lets a
 * seller insert their own line items, so anything this function claimed about
 * price would be a hole rather than a convenience.
 */
export async function addToCart(userId: string, input: AddToCartInput): Promise<void> {
  const orderId = await getOrCreateDraftOrder(userId);

  const { error } = await supabase.from('order_items').insert({
    order_id: orderId,
    product_id: input.productId,
    colour_id: input.colourId,
    variant_id: input.variantId,
    design_id: input.designId,
    size: input.size,
    print_method: input.printMethod,
    side: input.side,
    placement: input.placement,
    quantity: input.quantity,
    custom_name: input.customName,
  });

  if (error) throw new Error(error.message);
}

/** Number of line items in the open cart, for the sidebar badge. */
export async function countCartItems(userId: string): Promise<number> {
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .maybeSingle();

  if (!order) return 0;

  const { count, error } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id);

  if (error) return 0;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Reading and editing the open cart
// ---------------------------------------------------------------------------

export interface CartLine {
  id: string;
  productName: string;
  productSlug: string;
  colourName: string;
  colourHex: string;
  designName: string | null;
  designPath: string | null;
  size: string;
  printMethod: string;
  side: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  customName: string | null;
}

export interface Cart {
  orderId: string;
  lines: CartLine[];
  itemsTotal: number;
  shippingTotal: number;
  grandTotal: number;
}

/** The seller's open cart, or null when they have none. */
export async function getCart(userId: string): Promise<Cart | null> {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, items_total, shipping_total, grand_total')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .maybeSingle();

  if (orderErr) throw new Error(orderErr.message);
  if (!order) return null;

  const { data, error } = await supabase
    .from('order_items')
    .select(
      `id, size, print_method, side, quantity, unit_price, line_total, custom_name,
       products ( name, slug ),
       product_colours ( name, hex ),
       designs ( name, storage_path )`,
    )
    .eq('order_id', order.id)
    .order('created_at');

  if (error) throw new Error(error.message);

  // PostgREST types an embedded to-one relation as an array; the row shape is
  // wider than the query, so it is narrowed here rather than asserted upstream.
  type Row = {
    id: string;
    size: string;
    print_method: string;
    side: string;
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
    custom_name: string | null;
    products: { name: string; slug: string } | { name: string; slug: string }[] | null;
    product_colours: { name: string; hex: string } | { name: string; hex: string }[] | null;
    designs:
      | { name: string; storage_path: string }
      | { name: string; storage_path: string }[]
      | null;
  };

  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const lines: CartLine[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const product = one(r.products);
    const colour = one(r.product_colours);
    const design = one(r.designs);
    return {
      id: r.id,
      productName: product?.name ?? 'Product',
      productSlug: product?.slug ?? '',
      colourName: colour?.name ?? '—',
      colourHex: colour?.hex ?? '#FFFFFF',
      designName: design?.name ?? null,
      designPath: design?.storage_path ?? null,
      size: r.size,
      printMethod: r.print_method,
      side: r.side,
      quantity: r.quantity,
      unitPrice: Number(r.unit_price),
      lineTotal: Number(r.line_total),
      customName: r.custom_name,
    };
  });

  return {
    orderId: order.id,
    lines,
    itemsTotal: Number(order.items_total),
    shippingTotal: Number(order.shipping_total),
    grandTotal: Number(order.grand_total),
  };
}

export async function setLineQuantity(lineId: string, quantity: number): Promise<void> {
  if (quantity < 1) throw new Error('Quantity must be at least 1.');
  // line_total is recomputed by the pricing trigger, not sent from here.
  const { error } = await supabase
    .from('order_items')
    .update({ quantity })
    .eq('id', lineId);
  if (error) throw new Error(error.message);
}

export async function removeLine(lineId: string): Promise<void> {
  const { error } = await supabase.from('order_items').delete().eq('id', lineId);
  if (error) throw new Error(error.message);
}

/** Signed thumbnail URLs for the designs on these lines. */
export async function signCartThumbnails(lines: CartLine[]): Promise<Record<string, string>> {
  const paths = lines.map((l) => l.designPath).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from('designs').createSignedUrls(paths, 3600);
  if (error) return {};
  const byPath = new Map((data ?? []).map((r) => [r.path, r.signedUrl]));
  const out: Record<string, string> = {};
  for (const l of lines) {
    const url = l.designPath ? byPath.get(l.designPath) : undefined;
    if (url) out[l.id] = url;
  }
  return out;
}

export interface DeliveryDetails {
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * Place the open cart.
 *
 * Only the delivery details and the status are sent. The reference, the
 * timestamp, the delivery charge and every total are decided by
 * `enforce_order_rules` in the database, which also refuses an empty order or
 * an incomplete address — so this cannot place something invalid by getting
 * its own validation wrong.
 */
export async function placeOrder(
  orderId: string,
  details: DeliveryDetails,
): Promise<{ reference: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'placed',
      contact_name: details.contactName.trim(),
      contact_phone: details.contactPhone.trim(),
      address_line1: details.addressLine1.trim(),
      address_line2: details.addressLine2.trim() || null,
      city: details.city.trim(),
      state: details.state.trim(),
      pincode: details.pincode.trim(),
    })
    .eq('id', orderId)
    .select('reference')
    .single();

  if (error) throw new Error(error.message);
  return { reference: data?.reference ?? null };
}
