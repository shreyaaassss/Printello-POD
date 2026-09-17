import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatINR, listProducts } from '../features/catalogue/catalogue';
import { GarmentOutline, shapeForSlug } from '../features/garment/GarmentOutline';
import type { Product } from '../types/catalogue';

export function CreateProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Create Product | Printello POD';
    let active = true;
    listProducts()
      .then((rows) => {
        if (active) setProducts(rows);
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
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Create Product</h1>
      <p className="mt-2 text-muted">Pick a garment, then place your artwork on it.</p>

      {loading && <p className="mt-6 text-sm text-muted">Loading garments…</p>}
      {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <Link
            key={p.id}
            to={`/create/${p.slug}`}
            className="group rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="rounded-xl bg-brand-50 p-4">
              <GarmentOutline
                shape={shapeForSlug(p.slug)}
                hex="#FFFFFF"
                side="front"
                className="mx-auto aspect-[1000/1200] w-full max-w-[200px]"
              />
            </div>
            <p className="mt-3 font-medium text-ink group-hover:text-brand-700">{p.name}</p>
            <p className="mt-0.5 text-xs text-muted">
              {p.gsm ? `${p.gsm} GSM · ` : ''}from {formatINR(p.basePrice)}
            </p>
          </Link>
        ))}
      </div>

      {!loading && !error && products.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-muted">
          No garments in the catalogue yet.
        </p>
      )}
    </div>
  );
}
