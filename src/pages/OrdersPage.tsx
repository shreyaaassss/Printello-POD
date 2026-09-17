import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider';
import { formatINR } from '../features/catalogue/catalogue';
import {
  type OrderSummary,
  STATUS_LABEL,
  STATUS_TONE,
  formatDate,
  listMyOrders,
} from '../features/orders/orders';

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'My Orders | Printello POD';
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    listMyOrders(user.id)
      .then((rows) => active && setOrders(rows))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">My Orders</h1>

      {loading && <p className="mt-4 text-sm text-muted">Loading orders…</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!loading && orders.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white p-10 text-center">
          <p className="text-sm text-muted">No orders yet.</p>
          <Link
            to="/create"
            className="mt-4 inline-block rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white"
          >
            Create a product
          </Link>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Reference</th>
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
                  <td className="px-5 py-3 text-muted">{formatDate(o.placedAt ?? o.createdAt)}</td>
                  <td className="px-5 py-3 text-muted">{o.itemCount}</td>
                  <td className="px-5 py-3 text-ink">{formatINR(o.grandTotal)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/orders/${o.id}`} className="text-xs font-medium text-brand-700 underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
