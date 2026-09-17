import { supabase } from '../../lib/supabase';

export type OrderStatus =
  | 'draft'
  | 'placed'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'rejected'
  | 'returned';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Cart',
  placed: 'Placed',
  in_production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  returned: 'Returned',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  draft: 'bg-brand-50 text-muted',
  placed: 'bg-blue-50 text-blue-800',
  in_production: 'bg-amber-50 text-amber-900',
  shipped: 'bg-indigo-50 text-indigo-800',
  delivered: 'bg-brand-100 text-brand-700',
  cancelled: 'bg-gray-100 text-gray-700',
  rejected: 'bg-red-50 text-red-700',
  returned: 'bg-orange-50 text-orange-800',
};

/**
 * Mirrors `is_valid_order_transition` in migration 0009. This decides which
 * buttons appear; the database decides what is allowed. If the two disagree
 * the database wins and the action fails loudly, which is the right way round.
 */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  draft: [],
  placed: ['in_production', 'rejected', 'cancelled'],
  in_production: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  rejected: [],
  returned: [],
};

export interface OrderSummary {
  id: string;
  reference: string | null;
  status: OrderStatus;
  itemCount: number;
  grandTotal: number;
  placedAt: string | null;
  createdAt: string;
  contactName: string | null;
  city: string | null;
}

export interface OrderLine {
  id: string;
  productName: string;
  colourName: string;
  colourHex: string;
  size: string;
  printMethod: string;
  side: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  customName: string | null;
  designName: string | null;
  designPath: string | null;
  placement: unknown;
}

export interface OrderDetail extends OrderSummary {
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  state: string | null;
  pincode: string | null;
  itemsTotal: number;
  shippingTotal: number;
  courier: string | null;
  awb: string | null;
  trackingUrl: string | null;
  staffNote: string | null;
  lines: OrderLine[];
}

const SUMMARY_COLUMNS =
  'id, reference, status, grand_total, placed_at, created_at, contact_name, city, order_items(count)';

/** Orders belonging to the signed-in seller. Drafts are the cart, so excluded. */
export async function listMyOrders(userId: string): Promise<OrderSummary[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(SUMMARY_COLUMNS)
    .eq('user_id', userId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toSummary);
}

/**
 * Every order, for staff. RLS is what actually permits this — a non-admin
 * running the same query gets their own rows back, not an error.
 */
export async function listAllOrders(status?: OrderStatus | 'all'): Promise<OrderSummary[]> {
  let query = supabase.from('orders').select(SUMMARY_COLUMNS).neq('status', 'draft');
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSummary);
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, reference, status, items_total, shipping_total, grand_total, placed_at, created_at,
       contact_name, contact_phone, address_line1, address_line2, city, state, pincode,
       courier, awb, tracking_url, staff_note,
       order_items (
         id, size, print_method, side, quantity, unit_price, line_total, custom_name, placement,
         products ( name ), product_colours ( name, hex ), designs ( name, storage_path )
       )`,
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  type ItemRow = {
    id: string; size: string; print_method: string; side: string; quantity: number;
    unit_price: number | string; line_total: number | string; custom_name: string | null;
    placement: unknown;
    products: { name: string } | { name: string }[] | null;
    product_colours: { name: string; hex: string } | { name: string; hex: string }[] | null;
    designs: { name: string; storage_path: string } | { name: string; storage_path: string }[] | null;
  };

  const row = data as unknown as Record<string, unknown> & { order_items: ItemRow[] };

  const lines: OrderLine[] = (row.order_items ?? []).map((r) => {
    const colour = one(r.product_colours);
    const design = one(r.designs);
    return {
      id: r.id,
      productName: one(r.products)?.name ?? 'Product',
      colourName: colour?.name ?? '—',
      colourHex: colour?.hex ?? '#FFFFFF',
      size: r.size,
      printMethod: r.print_method,
      side: r.side,
      quantity: r.quantity,
      unitPrice: Number(r.unit_price),
      lineTotal: Number(r.line_total),
      customName: r.custom_name,
      designName: design?.name ?? null,
      designPath: design?.storage_path ?? null,
      placement: r.placement,
    };
  });

  return {
    id: String(row.id),
    reference: (row.reference as string | null) ?? null,
    status: row.status as OrderStatus,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    itemsTotal: Number(row.items_total),
    shippingTotal: Number(row.shipping_total),
    grandTotal: Number(row.grand_total),
    placedAt: (row.placed_at as string | null) ?? null,
    createdAt: String(row.created_at),
    contactName: (row.contact_name as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    addressLine1: (row.address_line1 as string | null) ?? null,
    addressLine2: (row.address_line2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    pincode: (row.pincode as string | null) ?? null,
    courier: (row.courier as string | null) ?? null,
    awb: (row.awb as string | null) ?? null,
    trackingUrl: (row.tracking_url as string | null) ?? null,
    staffNote: (row.staff_note as string | null) ?? null,
    lines,
  };
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw new Error(error.message);
}

export async function setFulfilment(
  orderId: string,
  fields: { courier?: string; awb?: string; trackingUrl?: string; staffNote?: string },
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({
      courier: fields.courier?.trim() || null,
      awb: fields.awb?.trim() || null,
      tracking_url: fields.trackingUrl?.trim() || null,
      staff_note: fields.staffNote?.trim() || null,
    })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
}

/**
 * Signed URLs for the artwork on an order. Staff can mint these for any
 * seller's files because the storage policy grants admins select — that is
 * what makes the print-floor download work without a public bucket.
 */
export async function signOrderArtwork(lines: OrderLine[]): Promise<Record<string, string>> {
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

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toSummary(row: Record<string, unknown>): OrderSummary {
  const counts = row.order_items as { count: number }[] | null;
  return {
    id: String(row.id),
    reference: (row.reference as string | null) ?? null,
    status: row.status as OrderStatus,
    itemCount: counts?.[0]?.count ?? 0,
    grandTotal: Number(row.grand_total),
    placedAt: (row.placed_at as string | null) ?? null,
    createdAt: String(row.created_at),
    contactName: (row.contact_name as string | null) ?? null,
    city: (row.city as string | null) ?? null,
  };
}
