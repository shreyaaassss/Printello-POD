import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { formatINR } from '../features/catalogue/catalogue';
import {
  type OrderDetail,
  STATUS_LABEL,
  STATUS_TONE,
  formatDate,
  getOrderDetail,
  signOrderArtwork,
} from '../features/orders/orders';

/** Seller's view of one order. Staff use /admin, which can also act on it. */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOrderDetail(id)
      .then(async (o) => {
        if (!active) return;
        setOrder(o);
        document.title = `${o?.reference ?? 'Order'} | Printello POD`;
        if (o) setThumbs(await signOrderArtwork(o.lines));
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <p className="text-sm text-muted">Loading order…</p>;
  if (error) return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!order) {
    return (
      <div>
        <p className="text-sm text-muted">That order could not be found.</p>
        <Link to="/orders" className="mt-3 inline-block text-sm text-brand-700 underline">
          Back to My Orders
        </Link>
      </div>
    );
  }

  return (
    <div>
      <nav className="text-sm text-muted">
        <Link to="/orders" className="hover:underline">My Orders</Link>
        <span className="px-2">/</span>
        <span className="text-ink">{order.reference ?? 'Order'}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">{order.reference ?? 'Order'}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </span>
        <span className="text-sm text-muted">
          Placed {formatDate(order.placedAt ?? order.createdAt)}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {order.lines.map((l) => (
            <div key={l.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                {thumbs[l.id] ? (
                  <img src={thumbs[l.id]} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-muted">No art</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{l.customName || l.productName}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {l.colourName} · {l.size} · {l.printMethod} · {l.side} · ×{l.quantity}
                </p>
              </div>
              <p className="shrink-0 font-medium text-ink">{formatINR(l.lineTotal)}</p>
            </div>
          ))}
        </div>

        <aside className="h-fit space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Items</dt><dd>{formatINR(order.itemsTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{order.shippingTotal === 0 ? 'Free' : formatINR(order.shippingTotal)}</dd></div>
              <div className="flex justify-between border-t border-brand-100 pt-2"><dt className="text-muted">Total</dt><dd className="font-semibold text-ink">{formatINR(order.grandTotal)}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Delivering to</h2>
            <p className="mt-2 text-sm text-ink">{order.contactName}</p>
            <p className="text-sm text-muted">{order.contactPhone}</p>
            <p className="mt-1 text-sm text-muted">
              {order.addressLine1}
              {order.addressLine2 ? `, ${order.addressLine2}` : ''}
              <br />
              {order.city}, {order.state} {order.pincode}
            </p>
          </div>

          {(order.courier || order.awb) && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Shipment</h2>
              <p className="mt-2 text-sm text-ink">{order.courier}</p>
              {order.awb && <p className="text-sm text-muted">AWB {order.awb}</p>}
              {order.trackingUrl && (
                <a href={order.trackingUrl} target="_blank" rel="noreferrer"
                   className="mt-1 inline-block text-sm text-brand-700 underline">
                  Track shipment
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
