/**
 * Built-in flat garment outlines, drawn in the same 1000x1200 coordinate space
 * that `print_areas` records its rectangles in. These are placeholders: once
 * real outlines are uploaded to the `garments` bucket and
 * `product_colours.front_image_path` is populated, the Customize screen shows
 * the image instead and these become the fallback.
 */

export type GarmentShape = 'tee' | 'longsleeve' | 'hoodie';

/** Maps a product slug to the placeholder shape that best represents it. */
export function shapeForSlug(slug: string): GarmentShape {
  if (slug.includes('hoodie')) return 'hoodie';
  if (slug.includes('sweatshirt')) return 'longsleeve';
  return 'tee';
}

/**
 * Silhouette stroke. Deliberately one neutral grey for every garment colour:
 * the outline is the boundary *between* garment and page, so a colour chosen
 * for contrast against the fill disappears against the background — which is
 * exactly how the hood went missing.
 */
const EDGE = '#6b7280';

const TEE_BODY =
  'M 380 170 C 400 240 600 240 620 170 L 760 210 L 880 300 L 800 430 ' +
  'L 740 396 L 740 1050 L 260 1050 L 260 396 L 200 430 L 120 300 L 240 210 Z';

// Long sleeves run most of the body length and end in a narrow cuff, which is
// what separates this shape from the tee at a glance.
const LONGSLEEVE_BODY =
  'M 380 170 C 400 240 600 240 620 170 L 775 215 L 900 320 L 860 880 ' +
  'L 745 862 L 745 1060 L 255 1060 L 255 862 L 140 880 L 100 320 L 225 215 Z';

const BODY: Record<GarmentShape, string> = {
  tee: TEE_BODY,
  longsleeve: LONGSLEEVE_BODY,
  hoodie: LONGSLEEVE_BODY,
};

interface Props {
  shape: GarmentShape;
  /** Garment colour as a hex string; the outline is filled with it. */
  hex: string;
  side: 'front' | 'back';
  className?: string;
}

/**
 * A flat garment silhouette filled in the chosen colour, rendered behind the
 * print area on the Customize screen.
 */
export function GarmentOutline({ shape, hex, side, className }: Props) {
  // Detail strokes sit *on* the garment, so they are derived from the fill
  // rather than picked from a fixed pair. A fixed light-grey vanished entirely
  // on Grey Melange, which sits right at the lightness threshold and happened
  // to match it.
  const detail = contrastingInk(hex);

  return (
    <svg
      viewBox="0 0 1000 1200"
      className={className}
      role="img"
      aria-label={`${shape} ${side}`}
    >
      {/* Hood first, so the shoulders overlap it and it reads as behind. It is
          filled in the garment colour with the neutral edge stroke, because it
          extends past the body outline onto the page. */}
      {shape === 'hoodie' && (
        <path
          d={
            side === 'front'
              ? 'M 360 215 C 330 40 670 40 640 215 C 600 150 400 150 360 215 Z'
              : 'M 355 215 C 325 30 675 30 645 215 Z'
          }
          fill={hex}
          stroke={EDGE}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      )}

      <path
        d={BODY[shape]}
        fill={hex}
        stroke={EDGE}
        strokeWidth={4}
        strokeLinejoin="round"
      />

      {/* Neckline: a collar band on the front, a wider yoke seam on the back. */}
      <path
        d={
          side === 'front'
            ? 'M 380 170 C 400 240 600 240 620 170'
            : 'M 360 180 C 420 215 580 215 640 180'
        }
        fill="none"
        stroke={detail}
        strokeWidth={side === 'front' ? 14 : 10}
      />

      {/* Cuffs and hem ribbing — the cue that reads as "sweatshirt" rather
          than "long tee". */}
      {shape !== 'tee' && (
        <g fill="none" stroke={detail} strokeWidth={6}>
          <path d="M 860 880 L 745 862" />
          <path d="M 140 880 L 255 862" />
          <path d="M 255 1008 L 745 1008" />
        </g>
      )}

      {/* Kangaroo pocket, hoodies only, and only on the front. */}
      {shape === 'hoodie' && side === 'front' && (
        <path
          d="M 300 820 L 700 820 L 665 985 L 335 985 Z"
          fill="none"
          stroke={detail}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      )}

      {/* Drawstrings, the other unmistakable hoodie cue. */}
      {shape === 'hoodie' && side === 'front' && (
        <g fill="none" stroke={detail} strokeWidth={7} strokeLinecap="round">
          <path d="M 450 225 L 440 330" />
          <path d="M 550 225 L 560 330" />
        </g>
      )}
    </svg>
  );
}

/** Perceived luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Whether a garment colour is light enough to need dark markings on it. */
export function isLight(hex: string): boolean {
  return luminance(hex) > 0.6;
}

/**
 * A seam/stitch colour guaranteed to be visible on `hex`, by moving the
 * garment colour itself toward black or white rather than choosing from a
 * fixed palette. Mid-tones are the case that breaks fixed palettes.
 */
export function contrastingInk(hex: string): string {
  const [r, g, b] = rgb(hex);
  const towardWhite = luminance(hex) <= 0.6;
  const mix = (c: number) =>
    Math.round(towardWhite ? c + (255 - c) * 0.55 : c * 0.55);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function rgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  if (v.length !== 6) return [255, 255, 255];
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}
