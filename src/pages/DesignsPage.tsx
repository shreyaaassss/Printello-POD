import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../features/auth/AuthProvider';
import {
  ACCEPT_ATTR,
  type Design,
  deleteDesign,
  formatBytes,
  listDesigns,
  signThumbnails,
  uploadDesign,
} from '../features/designs/designs';
import { maxPrintInches } from '../lib/imageProbe';

export function DesignsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [designs, setDesigns] = useState<Design[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'My Designs | Printello POD';
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const rows = await listDesigns(userId);
      setDesigns(rows);
      setThumbs(await signThumbnails(rows));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleFiles(files: FileList | File[]) {
    if (!userId) return;
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    setError(null);
    const warnings: string[] = [];

    for (const file of list) {
      try {
        const { design, opaque } = await uploadDesign(userId, file);
        if (opaque) {
          warnings.push(
            `“${design.name}” has no transparent background, so it will print as a filled rectangle. Save it as a PNG with transparency if the garment colour should show through.`,
          );
        }
      } catch (e) {
        warnings.push(`“${file.name}” — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    setNotices(warnings);
    setBusy(false);
    await refresh();
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? designs.filter((d) => d.name.toLowerCase().includes(q)) : designs;
  }, [designs, query]);

  async function onDelete(design: Design) {
    if (!confirm(`Delete “${design.name}”? This cannot be undone.`)) return;
    try {
      await deleteDesign(design);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Design Library</h1>
      <p className="mt-2 text-muted">Upload artwork here, then build products from it.</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`mt-6 rounded-2xl border-2 border-dashed bg-white p-10 text-center transition ${
          dragging ? 'border-brand-600 bg-brand-50' : 'border-brand-100'
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-full bg-brand-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload your design'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="mt-3 text-sm text-muted">
          PNG or JPG, or drag files here. PNG with a transparent background prints best.
        </p>
      </div>

      {notices.length > 0 && (
        <div className="mt-4 space-y-2">
          {notices.map((n, i) => (
            <p key={i} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {n}
            </p>
          ))}
          <button
            type="button"
            onClick={() => setNotices([])}
            className="text-xs font-medium text-muted underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">Design Collection</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search designs by name"
          className="w-72 rounded-full border border-brand-100 bg-white px-4 py-2 text-sm outline-none focus:border-brand-600"
        />
      </div>

      {loading && <p className="mt-6 text-sm text-muted">Loading designs…</p>}

      {!loading && visible.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-muted">
          {designs.length === 0
            ? 'No designs yet. Upload one to get started.'
            : 'No designs match that search.'}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((d) => (
          <DesignCard key={d.id} design={d} url={thumbs[d.id]} onDelete={() => void onDelete(d)} />
        ))}
      </div>
    </div>
  );
}

function DesignCard({
  design,
  url,
  onDelete,
}: {
  design: Design;
  url?: string;
  onDelete: () => void;
}) {
  const print =
    design.widthPx && design.heightPx ? maxPrintInches(design.widthPx, design.heightPx) : null;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* Chequerboard, so transparency is visible rather than assumed. */}
      <div
        className="flex h-44 items-center justify-center bg-brand-50"
        style={{
          backgroundImage:
            'linear-gradient(45deg,#e6ece9 25%,transparent 25%),linear-gradient(-45deg,#e6ece9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e6ece9 75%),linear-gradient(-45deg,transparent 75%,#e6ece9 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
        }}
      >
        {url ? (
          <img src={url} alt={design.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted">No preview</span>
        )}
      </div>

      <div className="p-4">
        <p className="truncate font-medium text-ink" title={design.name}>
          {design.name}
        </p>
        <p className="mt-1 text-xs text-muted">
          {design.widthPx && design.heightPx
            ? `${design.widthPx} × ${design.heightPx} px`
            : 'Size unknown'}
          {design.bytes ? ` · ${formatBytes(design.bytes)}` : ''}
        </p>
        {print && (
          <p className="mt-1 text-xs text-muted">
            Sharp up to {print.width.toFixed(1)}″ × {print.height.toFixed(1)}″
          </p>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 text-xs font-medium text-red-700 underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
