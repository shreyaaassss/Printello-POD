import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider';
import {
  type Cart,
  getCart,
  removeLine,
  setLineQuantity,
  signCartThumbnails,
} from '../features/cart/cart';
import { formatINR } from '../features/catalogue/catalogue';

export function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Cart | Printello POD';
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const next = await getCart(user.id);
      setCart(next);
      setThumbs(next ? await signCartThumbnails(next.lines) : {});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function changeQuantity(lineId: string, quantity: number) {
    setBusyLine(lineId);
    try {
      await setLineQuantity(lineId, quantity);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyLine(null);
    }
  }

  async function remove(lineId: string) {
    setBusyLine(lineId);
    try {
      await removeLine(lineId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyLine(null);
    }
  }

  const empty = !cart || cart.lines.length === 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Cart</h1>

      {loading && <p className="mt-4 text-sm text-muted">Loading your cart…</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!loading && empty && (
        <div className="mt-6 rounded-2xl bg-white p-10 text-center">
          <p className="text-sm text-muted">Nothing in your cart yet.</p>
          <Link
            to="/create"
            className="mt-4 inline-block rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white"
          >
            Create a product
          </Link>
        </div>
      )}

      {!loading && cart && cart.lines.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {cart.lines.map((line) => (
              <div
                key={line.id}
                className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm"
              >
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                  {thumbs[line.id] ? (
                    <img
                      src={thumbs[line.id]}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted">No art</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {line.customName || line.productName}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-brand-100"
                        style={{ backgroundColor: line.colourHex }}
                      />
                      {line.colourName}
                    </span>
                    <span>· {line.size}</span>
                    <span>· {line.printMethod}</span>
                    <span>· {line.side}</span>
                  </p>
                  {line.designName && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      Artwork: {line.designName}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Qty
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        disabled={busyLine === line.id}
                        onChange={(e) =>
                          void changeQuantity(line.id, Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-20 rounded-lg border border-brand-100 px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void remove(line.id)}
                      disabled={busyLine === line.id}
                      className="text-xs font-medium text-red-700 underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-medium text-ink">{formatINR(line.lineTotal)}</p>
                  <p className="text-xs text-muted">{formatINR(line.unitPrice)} each</p>
                </div>
              </div>
            ))}
          </div>

          <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Summary
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Items" value={formatINR(cart.itemsTotal)} />
              <Row
                label="Delivery"
                value={cart.shippingTotal === 0 ? 'Free' : formatINR(cart.shippingTotal)}
              />
              <div className="border-t border-brand-100 pt-2">
                <Row label="Total" value={formatINR(cart.grandTotal)} strong />
              </div>
            </dl>
            {cart.shippingTotal > 0 && (
              <p className="mt-2 text-xs text-muted">
                Free delivery on orders over {formatINR(999)}.
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="mt-5 w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-900"
            >
              Proceed to checkout
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              No payment online — a Printello representative confirms the order and
              collects payment.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? 'font-semibold text-ink' : 'text-ink'}>{value}</dd>
    </div>
  );
}
