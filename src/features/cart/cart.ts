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
