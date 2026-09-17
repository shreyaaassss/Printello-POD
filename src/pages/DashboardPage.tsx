import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider';
import { displayName } from '../features/auth/auth';
import { countCartItems } from '../features/cart/cart';
import { formatINR } from '../features/catalogue/catalogue';
import { listDesigns } from '../features/designs/designs';
import {
  type OrderSummary,
  STATUS_LABEL,
  STATUS_TONE,
  formatDate,
  listMyOrders,
} from '../features/orders/orders';

/** Statuses that still need something to happen. */
const ACTIVE: string[] = ['placed', 'in_production', 'shipped'];

export function DashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [designCount, setDesignCount] = useState<number | null>(null);
  const [cartCount, setCartCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Dashboard | Printello POD';
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([listMyOrders(user.id), listDesigns(user.id), countCartItems(user.id)])
      .then(([o, d, c]) => {
        if (!active) return;
        setOrders(o);
        setDesignCount(d.length);
        setCartCount(c);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  const activeCount = orders.filter((o) => ACTIVE.includes(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
  const spend = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'rejected')
    .reduce((sum, o) => sum + o.grandTotal, 0);

  return (
    <div>
      <div className="rounded-2xl bg-brand-700 p-8 text-white">
        <h1 className="text-2xl font-semibold">
          {user ? `Welcome, ${displayName(user)}` : 'Welcome'}
        </h1>
        <p className="mt-1 text-brand-100">
          Upload artwork, build a product, and we print and ship it.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/create"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-brand-700"
          >
            Create a product
          </Link>
          <Link
            to="/designs"
            className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-medium text-white"
          >
            Upload a design
          </Link>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Designs" value={designCount} loading={loading} to="/designs" />
        <Stat label="In cart" value={cartCount} loading={loading} to="/cart" />
        <Stat label="Active orders" value={activeCount} loading={loading} to="/orders" />
        <Stat label="Delivered" value={deliveredCount} loading={loading} to="/orders" />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Recent orders</h2>
          {orders.length > 0 && (
            <Link to="/orders" className="text-sm text-brand-700 underline">
              View all
            </Link>
          )}
        </div>

        {loading && <p className="mt-3 text-sm text-muted">Loading…</p>}

        {!loading && orders.length === 0 && (
          <p className="mt-3 rounded-2xl bg-white p-8 text-center text-sm text-muted">
            No orders yet. Your first one will appear here.
          </p>
        )}

        {orders.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
            {orders.slice(0, 5).map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="flex items-center justify-between gap-4 border-b border-brand-50 px-5 py-3 last:border-0 hover:bg-brand-50"
              >
                <span className="font-medium text-ink">{o.reference ?? '—'}</span>
                <span className="text-sm text-muted">
                  {formatDate(o.placedAt ?? o.createdAt)}
                </span>
                <span className="text-sm text-ink">{formatINR(o.grandTotal)}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[o.status]}`}
                >
                  {STATUS_LABEL[o.status]}
                </span>
              </Link>
            ))}
          </div>
        )}

        {!loading && orders.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Ordered {formatINR(spend)} across {orders.length} order
            {orders.length === 1 ? '' : 's'}.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  to,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  to: string;
}) {
  return (
    <Link to={to} className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">
        {loading || value === null ? '—' : value}
      </p>
    </Link>
  );
}
