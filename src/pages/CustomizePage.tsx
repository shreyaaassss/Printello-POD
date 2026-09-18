import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  SIZE_ORDER,
  findVariant,
  formatINR,
  getProductDetail,
  listProducts,
  unitPrice,
  type ProductDetail,
} from '../features/catalogue/catalogue';
import { ArtworkStage } from '../features/customize/ArtworkStage';
import { garmentOutlineUrl } from '../features/garment/garmentAssets';
import { DesignPicker } from '../features/customize/DesignPicker';
import {
  DPI_OK,
  MIN_SCALE,
  clampPlacement,
  effectiveDpi,
  fitPlacement,
  maxScale,
  printedInches,
  type Placement,
} from '../features/customize/placement';
import { addToCart } from '../features/cart/cart';
import { useAuth } from '../features/auth/AuthProvider';
import { type Design, signThumbnails } from '../features/designs/designs';
import type { PrintMethod, PrintSide, Product, SizeCode } from '../types/catalogue';

export function CustomizePage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [siblings, setSiblings] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [colourId, setColourId] = useState<string | null>(null);
  const [size, setSize] = useState<SizeCode>('M');
  const [side, setSide] = useState<PrintSide>('front');
  const [method, setMethod] = useState<PrintMethod>('DTF');
  const [showSizeChart, setShowSizeChart] = useState(false);

  const [design, setDesign] = useState<Design | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [customName, setCustomName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([getProductDetail(slug), listProducts()])
      .then(([d, all]) => {
        if (!active) return;
        setSiblings(all);
        setDetail(d);
        if (d) {
          document.title = `${d.product.name} | Printello POD`;
          const firstColour = d.colours[0] ?? null;
          setColourId(firstColour?.id ?? null);
          // Default to a print method this garment actually offers: hoodies
          // are DTF-only, so a remembered DTG would be invalid here.
          setMethod(d.product.printMethods[0] ?? 'DTF');
          // Never open on a size that cannot be ordered. Prefer M, then the
          // first size actually stocked in the default colour.
          if (firstColour) {
            const stocked = SIZE_ORDER.filter(
              (s) => findVariant(d.variants, firstColour.id, s)?.inStock,
            );
            if (stocked.length > 0) setSize(stocked.includes('M') ? 'M' : stocked[0]);
          }
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const colour = useMemo(
    () => detail?.colours.find((c) => c.id === colourId) ?? detail?.colours[0] ?? null,
    [detail, colourId],
  );

  const variant = useMemo(
    () => (detail && colour ? findVariant(detail.variants, colour.id, size) : undefined),
    [detail, colour, size],
  );

  const price = detail ? unitPrice(detail.product, variant) : 0;
  const printArea = detail?.printAreas[side] ?? null;

  const aspect =
    design?.widthPx && design?.heightPx ? design.widthPx / design.heightPx : 1;

  // Front and back can have different printable areas — the hoodie's front is
  // shorter to clear the pocket — so a placement valid on one side may not be
  // valid on the other. Re-fit whenever the area underneath it changes.
  useEffect(() => {
    if (!printArea || !design) return;
    setPlacement((current) =>
      current ? clampPlacement(printArea, aspect, current) : fitPlacement(printArea, aspect),
    );
  }, [printArea, design, aspect]);

  async function onPickDesign(picked: Design) {
    setPickerOpen(false);
    setDesign(picked);
    setAdded(false);
    const urls = await signThumbnails([picked]);
    setArtworkUrl(urls[picked.id] ?? null);
    if (printArea) {
      const a = picked.widthPx && picked.heightPx ? picked.widthPx / picked.heightPx : 1;
      setPlacement(fitPlacement(printArea, a));
    }
  }

  const dpi =
    printArea && design?.widthPx && placement
      ? effectiveDpi(printArea, design.widthPx, aspect, placement)
      : null;

  const printed = printArea && placement ? printedInches(printArea, aspect, placement) : null;

  async function onAddToCart() {
    if (!user || !detail || !colour || !variant || !design || !placement) return;
    setAdding(true);
    setAddError(null);
    try {
      await addToCart(user.id, {
        productId: detail.product.id,
        colourId: colour.id,
        variantId: variant.id,
        designId: design.id,
        size,
        printMethod: method,
        side,
        placement,
        quantity,
        customName: customName.trim() || null,
      });
      setAdded(true);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading garment…</p>;
  if (error) return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!detail) {
    return (
      <div>
        <p className="text-sm text-muted">That garment isn’t in the catalogue.</p>
        <Link to="/create" className="mt-3 inline-block text-sm text-brand-700 underline">
          Back to Create Product
        </Link>
      </div>
    );
  }

  const { product, colours, variants } = detail;

  return (
    <div>
      <nav className="text-sm text-muted">
        <Link to="/create" className="hover:underline">
          Create Product
        </Link>
        <span className="px-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-5 flex gap-8">
        {/* Garment switcher, mirroring the sub-nav on POD India. */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <ul className="space-y-1">
            {siblings.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/create/${p.slug}`}
                  className={`block rounded-lg px-3 py-2 text-sm transition ${
                    p.slug === slug
                      ? 'bg-brand-100 font-medium text-brand-700'
                      : 'text-muted hover:bg-brand-50'
                  }`}
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="grid min-w-0 flex-1 gap-8 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <ArtworkStage
              slug={product.slug}
              hex={colour?.hex ?? '#FFFFFF'}
              side={side}
              printArea={printArea}
              outlineUrl={garmentOutlineUrl(colour, side)}
              artworkUrl={artworkUrl}
              aspect={aspect}
              placement={placement ?? { x: 0.5, y: 0.5, scale: 1, rotation: 0 }}
              onPlacementChange={setPlacement}
              className="mx-auto max-w-[360px]"
            />

            <div className="mt-4 flex justify-center gap-2">
              {(['front', 'back'] as PrintSide[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`rounded-full px-4 py-1.5 text-sm capitalize transition ${
                    side === s ? 'bg-brand-600 text-white' : 'bg-brand-50 text-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {printArea && (
              <p className="mt-3 text-center text-xs text-muted">
                Printable area {printArea.widthIn}″ × {printArea.heightIn}″
                {design ? ' · drag the design to reposition' : ''}
              </p>
            )}

            {design && placement && printArea && (
              <div className="mt-4">
                <label className="flex items-center gap-3 text-sm text-muted">
                  <span className="w-12 shrink-0">Size</span>
                  <input
                    type="range"
                    min={MIN_SCALE}
                    max={maxScale(printArea, aspect)}
                    step={0.01}
                    value={placement.scale}
                    onChange={(e) =>
                      setPlacement(
                        clampPlacement(printArea, aspect, {
                          ...placement,
                          scale: Number(e.target.value),
                        }),
                      )
                    }
                    className="flex-1 accent-brand-600"
                  />
                </label>
                {printed && (
                  <p className="mt-1 text-center text-xs text-muted">
                    Prints at {printed.width.toFixed(1)}″ × {printed.height.toFixed(1)}″
                    {dpi ? ` · ${Math.round(dpi)} DPI` : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {product.name}
            </p>
            <h1 className="text-2xl font-semibold text-ink">
              {product.gsm ? `${product.gsm} Gsm ` : ''}
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-1 text-sm text-muted">{product.description}</p>
            )}

            <p className="mt-4 text-2xl font-semibold text-brand-700">{formatINR(price)}</p>
            <p className="text-xs text-muted">per piece, excluding delivery</p>

            <Section label={`Colour: ${colour?.name ?? '—'}`}>
              <div className="flex flex-wrap gap-2">
                {colours.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => setColourId(c.id)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-9 w-9 rounded-full border-2 transition ${
                      c.id === colour?.id
                        ? 'border-brand-600 ring-2 ring-brand-100'
                        : 'border-brand-100'
                    }`}
                  >
                    <span className="sr-only">{c.name}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section label={`Size: ${size}`}>
              <div className="flex flex-wrap gap-2">
                {SIZE_ORDER.map((s) => {
                  const v = colour ? findVariant(variants, colour.id, s) : undefined;
                  // No row at all is as unavailable as a row marked out of stock.
                  const available = Boolean(v?.inStock);
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!available}
                      onClick={() => setSize(s)}
                      title={available ? undefined : 'Out of stock in this colour'}
                      className={`relative min-w-[52px] rounded-lg border px-3 py-2 text-sm transition ${
                        size === s && available
                          ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                          : 'border-brand-100 text-muted'
                      } ${available ? 'hover:border-brand-600' : 'cursor-not-allowed opacity-40'}`}
                    >
                      {s}
                      {!available && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        >
                          <span className="h-px w-8 rotate-[-20deg] bg-red-500" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {!variant?.inStock && (
                <p className="mt-2 text-xs text-amber-800">
                  {size} isn’t stocked in {colour?.name}. Pick another size or colour.
                </p>
              )}
            </Section>

            {product.sizeChart && product.sizeChart.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowSizeChart((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-brand-100 px-4 py-2.5 text-sm text-ink"
                >
                  Size Dimensions
                  <span className="text-muted">{showSizeChart ? '−' : '+'}</span>
                </button>
                {showSizeChart && (
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted">
                        <th className="py-1">Size</th>
                        <th className="py-1">Chest</th>
                        <th className="py-1">Length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.sizeChart.map((r) => (
                        <tr key={r.size} className="border-t border-brand-100">
                          <td className="py-1.5 font-medium text-ink">{r.size}</td>
                          <td className="py-1.5 text-muted">{r.chestIn}″</td>
                          <td className="py-1.5 text-muted">{r.lengthIn}″</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <Section label={`${side === 'front' ? 'Front' : 'Back'} Side Printing Type`}>
              <div className="flex gap-4">
                {product.printMethods.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="print-method"
                      checked={method === m}
                      onChange={() => setMethod(m)}
                      className="accent-brand-600"
                    />
                    {m}
                  </label>
                ))}
              </div>
              {product.printMethods.length === 1 && (
                <p className="mt-1 text-xs text-muted">
                  This garment is {product.printMethods[0]} only.
                </p>
              )}
            </Section>

            <Section label="Artwork">
              {design ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-100 p-3">
                  <span className="truncate text-sm text-ink">{design.name}</span>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="shrink-0 text-xs font-medium text-brand-700 underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full rounded-lg border border-dashed border-brand-100 px-4 py-3 text-sm text-muted hover:border-brand-600"
                >
                  Choose a design
                </button>
              )}
            </Section>

            {/* Low resolution warns, never blocks — artwork is reviewed by a
                person before anything is printed. */}
            {dpi !== null && dpi < DPI_OK && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                At this size the print will look soft — blurred or pixelated —
                and that cannot be corrected during printing. Scaling the design
                down, or using a higher-resolution file, will sharpen it.
              </p>
            )}

            <Section label="Product name (optional)">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Summer Drop Tee"
                className="w-full rounded-lg border border-brand-100 px-4 py-2.5 text-sm outline-none focus:border-brand-600"
              />
            </Section>

            <Section label="Quantity">
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-28 rounded-lg border border-brand-100 px-4 py-2.5 text-sm outline-none focus:border-brand-600"
              />
              <p className="mt-2 text-sm text-muted">
                Total {formatINR(price * quantity)}
              </p>
            </Section>

            <button
              type="button"
              onClick={() => void onAddToCart()}
              disabled={!design || !variant?.inStock || adding}
              className="mt-6 w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? 'Adding…' : 'Add to Cart'}
            </button>

            {!design && (
              <p className="mt-2 text-center text-xs text-muted">
                Choose a design to continue.
              </p>
            )}
            {addError && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{addError}</p>
            )}
            {added && (
              <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
                Added to your cart.{' '}
                <Link to="/cart" className="underline">
                  View cart
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      {pickerOpen && user && (
        <DesignPicker
          userId={user.id}
          onPick={(d) => void onPickDesign(d)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      {children}
    </div>
  );
}
