import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider';
import { type Cart, type DeliveryDetails, getCart, placeOrder } from '../features/cart/cart';
import { formatINR } from '../features/catalogue/catalogue';
import { lookupPincode } from '../features/checkout/pincodeLookup';
import { useProfile } from '../features/profile/useProfile';

const EMPTY: DeliveryDetails = {
  contactName: '',
  contactPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
};

export function CheckoutPage() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id ?? null);

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<DeliveryDetails>(EMPTY);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [pinStatus, setPinStatus] = useState<string | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    document.title = 'Checkout | Printello POD';
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getCart(user.id)
      .then((c) => active && setCart(c))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  // Prefill once from the profile, then leave the form alone — re-applying it
  // would fight the user as they type.
  useEffect(() => {
    if (prefilled.current || !profile) return;
    prefilled.current = true;
    setDetails((d) => ({
      ...d,
      contactName: d.contactName || profile.fullName || '',
      contactPhone: d.contactPhone || profile.phone || '',
      addressLine1: d.addressLine1 || profile.addressLine1 || '',
      addressLine2: d.addressLine2 || profile.addressLine2 || '',
      city: d.city || profile.city || '',
      state: d.state || profile.state || '',
      pincode: d.pincode || profile.pincode || '',
    }));
  }, [profile]);

  // Resolve the PIN to a city and state, so the address cannot disagree with
  // the PIN the order ships against.
  useEffect(() => {
    const pin = details.pincode.trim();
    if (!/^\d{6}$/.test(pin)) {
      setPinStatus(null);
      return;
    }
    const controller = new AbortController();
    setPinStatus('Looking up…');
    lookupPincode(pin, controller.signal)
      .then((info) => {
        if (!info) {
          setPinStatus('That PIN code was not found.');
          return;
        }
        setPinStatus(`${info.city}, ${info.state}`);
        setDetails((d) => ({ ...d, city: info.city, state: info.state }));
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setPinStatus('Could not check that PIN code.');
      });
    return () => controller.abort();
  }, [details.pincode]);

  async function onPlace() {
    if (!cart) return;
    setPlacing(true);
    setError(null);
    try {
      const { reference: ref } = await placeOrder(cart.orderId, details);
      setReference(ref);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlacing(false);
    }
  }

  if (reference) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">Order placed</h1>
        <p className="mt-2 text-muted">
          Your reference is <span className="font-semibold text-brand-700">{reference}</span>.
        </p>
        <p className="mt-4 text-sm text-muted">
          A Printello representative will review the artwork, confirm the order and
          arrange payment. Nothing is charged online.
        </p>
        <Link
          to="/orders"
          className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white"
        >
          View my orders
        </Link>
      </div>
    );
  }

  if (loading) return <p className="text-sm text-muted">Loading checkout…</p>;

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center">
        <p className="text-sm text-muted">There is nothing to check out.</p>
        <Link to="/create" className="mt-4 inline-block text-sm text-brand-700 underline">
          Create a product
        </Link>
      </div>
    );
  }

  const complete =
    details.contactName.trim() &&
    details.contactPhone.trim() &&
    details.addressLine1.trim() &&
    details.city.trim() &&
    details.state.trim() &&
    /^\d{6}$/.test(details.pincode.trim());

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Checkout</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Delivery details
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" value={details.contactName}
              onChange={(v) => setDetails((d) => ({ ...d, contactName: v }))} />
            <Field label="Phone" value={details.contactPhone} inputMode="tel"
              onChange={(v) => setDetails((d) => ({ ...d, contactPhone: v }))} />
            <Field label="Address line 1" value={details.addressLine1} span
              onChange={(v) => setDetails((d) => ({ ...d, addressLine1: v }))} />
            <Field label="Address line 2 (optional)" value={details.addressLine2} span
              onChange={(v) => setDetails((d) => ({ ...d, addressLine2: v }))} />
            <div>
              <Field label="PIN code" value={details.pincode} inputMode="numeric"
                onChange={(v) =>
                  setDetails((d) => ({ ...d, pincode: v.replace(/\D/g, '').slice(0, 6) }))
                } />
              {pinStatus && <p className="mt-1 text-xs text-muted">{pinStatus}</p>}
            </div>
            <Field label="City" value={details.city}
              onChange={(v) => setDetails((d) => ({ ...d, city: v }))} />
            <Field label="State" value={details.state}
              onChange={(v) => setDetails((d) => ({ ...d, state: v }))} />
          </div>
        </div>

        <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Summary</h2>
          <p className="mt-3 text-sm text-muted">
            {cart.lines.length} item{cart.lines.length === 1 ? '' : 's'}
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Items</dt>
              <dd className="text-ink">{formatINR(cart.itemsTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="text-ink">
                {cart.shippingTotal === 0 ? 'Free' : formatINR(cart.shippingTotal)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-brand-100 pt-2">
              <dt className="text-muted">Total</dt>
              <dd className="font-semibold text-ink">{formatINR(cart.grandTotal)}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => void onPlace()}
            disabled={!complete || placing}
            className="mt-5 w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {placing ? 'Placing…' : 'Place order'}
          </button>
          {!complete && (
            <p className="mt-2 text-center text-xs text-muted">
              Fill in the delivery details to continue.
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}
          <p className="mt-3 text-center text-xs text-muted">
            Payment is arranged after the artwork is reviewed.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  span,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  span?: boolean;
  inputMode?: 'tel' | 'numeric';
}) {
  return (
    <label className={`block ${span ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-brand-100 px-4 py-2.5 text-sm outline-none focus:border-brand-600"
      />
    </label>
  );
}
