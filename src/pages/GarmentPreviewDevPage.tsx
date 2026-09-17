import { GarmentPreview } from '../features/garment/GarmentPreview';
import type { PrintArea, PrintSide } from '../types/catalogue';

/**
 * Development-only visual check for the placeholder garment shapes. Routed
 * behind `import.meta.env.DEV` so it never reaches a build. It exists because
 * the outlines are SVG drawn by hand, and the only way to know whether a
 * hoodie reads as a hoodie is to look at it.
 */
const AREA: PrintArea = {
  id: 'dev',
  productId: 'dev',
  side: 'front',
  imageWidth: 1000,
  imageHeight: 1200,
  x: 310,
  y: 420,
  width: 380,
  height: 507,
  widthIn: 12,
  heightIn: 16,
};

const CASES: Array<{ label: string; slug: string; hex: string; side: PrintSide }> = [
  { label: 'Tee front / White', slug: 'regular-tshirt', hex: '#FFFFFF', side: 'front' },
  { label: 'Tee back / White', slug: 'regular-tshirt', hex: '#FFFFFF', side: 'back' },
  { label: 'Tee front / Black', slug: 'regular-tshirt', hex: '#111111', side: 'front' },
  { label: 'Tee front / Red', slug: 'oversized-tshirt', hex: '#C8102E', side: 'front' },
  { label: 'Sweatshirt front / Navy', slug: 'sweatshirt', hex: '#1B2A4A', side: 'front' },
  { label: 'Sweatshirt back / Navy', slug: 'sweatshirt', hex: '#1B2A4A', side: 'back' },
  { label: 'Hoodie front / Green', slug: 'oversized-hoodie', hex: '#0B6B3A', side: 'front' },
  { label: 'Hoodie back / Green', slug: 'oversized-hoodie', hex: '#0B6B3A', side: 'back' },
  { label: 'Hoodie front / Grey', slug: 'oversized-hoodie', hex: '#9AA0A6', side: 'front' },
];

export function GarmentPreviewDevPage() {
  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {CASES.map((c) => (
        <div key={c.label} className="rounded-2xl bg-white p-3 text-center">
          <GarmentPreview
            slug={c.slug}
            hex={c.hex}
            side={c.side}
            printArea={{ ...AREA, side: c.side }}
            className="mx-auto max-w-[220px]"
          />
          <p className="mt-2 text-xs text-muted">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
