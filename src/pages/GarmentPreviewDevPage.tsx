import { useState } from 'react';

import { GarmentPreview } from '../features/garment/GarmentPreview';
import { ArtworkStage } from '../features/customize/ArtworkStage';
import { clampPlacement, fitPlacement, type Placement } from '../features/customize/placement';
import type { PrintArea, PrintSide } from '../types/catalogue';

/** A 3:2 test pattern with a hard border, so clipping and scale are obvious. */
const TEST_ART =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
       <rect width="300" height="200" fill="#ffd166" stroke="#073b4c" stroke-width="8"/>
       <path d="M0 0 L300 200 M300 0 L0 200" stroke="#ef476f" stroke-width="6"/>
       <circle cx="150" cy="100" r="46" fill="#06d6a0" stroke="#073b4c" stroke-width="6"/>
     </svg>`,
  );
const TEST_ASPECT = 300 / 200;

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

function StageCase({
  label,
  slug,
  hex,
  area,
  initial,
}: {
  label: string;
  slug: string;
  hex: string;
  area: PrintArea;
  initial: Placement;
}) {
  const [placement, setPlacement] = useState<Placement>(
    clampPlacement(area, TEST_ASPECT, initial),
  );
  return (
    <div className="rounded-2xl bg-white p-3 text-center">
      <ArtworkStage
        slug={slug}
        hex={hex}
        side="front"
        printArea={area}
        artworkUrl={TEST_ART}
        aspect={TEST_ASPECT}
        placement={placement}
        onPlacementChange={setPlacement}
        className="mx-auto max-w-[220px]"
      />
      <p className="mt-2 text-xs text-muted">{label}</p>
    </div>
  );
}

const HOODIE_AREA: PrintArea = { ...AREA, y: 380, height: 400, heightIn: 12.6 };

export function GarmentPreviewDevPage() {
  return (
    <div className="p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Artwork placement
      </h2>
      <div className="mb-8 grid grid-cols-4 gap-4">
        <StageCase
          label="fit (centred, max scale)"
          slug="regular-tshirt"
          hex="#FFFFFF"
          area={AREA}
          initial={fitPlacement(AREA, TEST_ASPECT)}
        />
        <StageCase
          label="scaled to 40%"
          slug="regular-tshirt"
          hex="#111111"
          area={AREA}
          initial={{ x: 0.5, y: 0.5, scale: 0.4, rotation: 0 }}
        />
        <StageCase
          label="dragged off top-left → clamped"
          slug="oversized-tshirt"
          hex="#1B2A4A"
          area={AREA}
          initial={{ x: -3, y: -3, scale: 0.5, rotation: 0 }}
        />
        <StageCase
          label="hoodie: shorter area, clears pocket"
          slug="oversized-hoodie"
          hex="#0B6B3A"
          area={HOODIE_AREA}
          initial={fitPlacement(HOODIE_AREA, TEST_ASPECT)}
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Garment shapes
      </h2>
      <div className="grid grid-cols-3 gap-4">
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
    </div>
  );
}
