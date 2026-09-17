import { useCallback, useEffect, useState } from 'react';

import { formatINR } from '../features/catalogue/catalogue';
import {
  NEXT_STATUSES,
  type OrderDetail,
  type OrderStatus,
  type OrderSummary,
  STATUS_LABEL,
  STATUS_TONE,
  formatDate,
  getOrderDetail,
  listAllOrders,
  setFulfilment,
  setOrderStatus,
  signOrderArtwork,
} from '../features/orders/orders';

const FILTERS: Array<OrderStatus | 'all'> = [
  'all', 'placed', 'in_production', 'shipped', 'delivered', 'rejected', 'returned', 'cancelled',
];

export function AdminOrdersPage() {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('placed');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Admin | Printello POD';
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await listAllOrders(filter));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Admin — Orders</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition ${
              filter === f ? 'bg-brand-900 text-white' : 'bg-white text-muted hover:bg-brand-50'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-sm text-muted">Loading…</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!loading && orders.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-muted">
          No orders with this status.
        </p>
      )}

      {orders.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Placed</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-brand-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{o.reference ?? '—'}</td>
                  <td className="px-5 py-3 text-muted">
                    {o.contactName ?? '—'}
                    {o.city ? `, ${o.city}` : ''}
                  </td>
                  <td className="px-5 py-3 text-muted">{formatDate(o.placedAt ?? o.createdAt)}</td>
                  <td className="px-5 py-3 text-muted">{o.itemCount}</td>
                  <td className="px-5 py-3 text-ink">{formatINR(o.grandTotal)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      className="text-xs font-medium text-brand-700 underline"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <AdminOrderDrawer
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => void refresh()}
        />
      )}
    </div>
  );
}

function AdminOrderDrawer({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [art, setArt] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courier, setCourier] = useState('');
  const [awb, setAwb] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  const load = useCallback(async () => {
    const o = await getOrderDetail(orderId);
    setOrder(o);
    if (o) {
      setCourier(o.courier ?? '');
      setAwb(o.awb ?? '');
      setTrackingUrl(o.trackingUrl ?? '');
      setArt(await signOrderArtwork(o.lines));
    }
  }, [orderId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      // The database is the authority on transitions, so a rejection here is
      // a real answer, not a glitch — show it rather than swallowing it.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {!order ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">{order.reference ?? 'Order'}</h2>
                <p className="mt-1 text-sm text-muted">
                  {order.contactName} · {order.contactPhone}
                </p>
                <p className="text-sm text-muted">
                  {order.addressLine1}
                  {order.addressLine2 ? `, ${order.addressLine2}` : ''}, {order.city},{' '}
                  {order.state} {order.pincode}
                </p>
              </div>
              <button type="button" onClick={onClose} className="text-sm text-muted underline">
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
              {NEXT_STATUSES[order.status].map((next) => (
                <button
                  key={next}
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => setOrderStatus(order.id, next))}
                  className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Mark {STATUS_LABEL[next].toLowerCase()}
                </button>
              ))}
              {NEXT_STATUSES[order.status].length === 0 && (
                <span className="text-xs text-muted">No further steps.</span>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
              Print queue
            </h3>
            <div className="mt-2 space-y-2">
              {order.lines.map((l) => (
                <div key={l.id} className="flex items-center gap-4 rounded-xl border border-brand-100 p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                    {art[l.id] ? (
                      <img src={art[l.id]} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted">No art</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {l.productName} · {l.colourName} · {l.size}
                    </p>
                    <p className="text-xs text-muted">
                      {l.printMethod} · {l.side} · ×{l.quantity} · {l.designName ?? 'no artwork'}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      placement {JSON.stringify(l.placement)}
                    </p>
                  </div>
                  {art[l.id] && (
                    <a
                      href={art[l.id]}
                      download
                      className="shrink-0 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-700"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
              Shipment
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <Input label="Courier" value={courier} onChange={setCourier} />
              <Input label="AWB" value={awb} onChange={setAwb} />
              <Input label="Tracking URL" value={trackingUrl} onChange={setTrackingUrl} />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => setFulfilment(order.id, { courier, awb, trackingUrl }))}
              className="mt-3 rounded-full bg-ink px-5 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Save shipment
            </button>

            <p className="mt-6 text-sm text-muted">
              Total {formatINR(order.grandTotal)} · {order.itemCount} piece
              {order.itemCount === 1 ? '' : 's'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm outline-none focus:border-brand-600"
      />
    </label>
  );
}
