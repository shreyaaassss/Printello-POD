import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { type Design, listDesigns, signThumbnails } from '../designs/designs';

interface Props {
  userId: string;
  onPick: (design: Design) => void;
  onClose: () => void;
}

/** Modal list of the seller's artwork, for choosing what to place. */
export function DesignPicker({ userId, onPick, onClose }: Props) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    listDesigns(userId)
      .then(async (rows) => {
        if (!active) return;
        setDesigns(rows);
        setThumbs(await signThumbnails(rows));
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visible = query.trim()
    ? designs.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()))
    : designs;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">Choose a design</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-56 rounded-full border border-brand-100 px-4 py-2 text-sm outline-none focus:border-brand-600"
          />
        </div>

        {loading && <p className="mt-6 text-sm text-muted">Loading your designs…</p>}
        {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

        {!loading && designs.length === 0 && (
          <p className="mt-6 text-sm text-muted">
            No designs yet.{' '}
            <Link to="/designs" className="text-brand-700 underline">
              Upload one first
            </Link>
            .
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onPick(d)}
              className="rounded-xl border border-brand-100 p-2 text-left transition hover:border-brand-600"
            >
              <div className="flex h-24 items-center justify-center rounded-lg bg-brand-50">
                {thumbs[d.id] ? (
                  <img src={thumbs[d.id]} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-muted">No preview</span>
                )}
              </div>
              <p className="mt-2 truncate text-xs font-medium text-ink">{d.name}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-full bg-brand-50 px-5 py-2 text-sm text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
