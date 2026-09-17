/**
 * Built-in flat garment outlines, drawn in the same 1000x1200 coordinate space
 * that `print_areas` records its rectangles in. These are placeholders: once
 * real outlines are uploaded to the `garments` bucket and
 * `product_colours.front_image_path` is populated, the Customize screen shows
 * the image instead and these are only the fallback.
 */

export type GarmentShape = 'tee' | 'longsleeve' | 'hoodie';

/** Maps a product slug to the placeholder shape that best represents it. */
export function shapeForSlug(slug: string): GarmentShape {
  if (slug.includes('hoodie')) return 'hoodie';
  if (slug.includes('sweatshirt')) return 'longsleeve';
  return 'tee';
}

// Body outlines. Each ends at the hem so the shapes can share sleeve variants.
const TEE_BODY =
  'M 380 170 C 400 240 600 240 620 170 L 760 210 L 880 300 L 800 430 ' +
  'L 740 396 L 740 1050 L 260 1050 L 260 396 L 200 430 L 120 300 L 240 210 Z';

const LONGSLEEVE_BODY =
  'M 380 170 C 400 240 600 240 620 170 L 770 215 L 880 310 L 830 780 ' +
  'L 725 760 L 740 1050 L 260 1050 L 275 760 L 170 780 L 120 310 L 230 215 Z';

const HOODIE_BODY = LONGSLEEVE_BODY;

const BODY: Record<GarmentShape, string> = {
  tee: TEE_BODY,
  longsleeve: LONGSLEEVE_BODY,
  hoodie: HOODIE_BODY,
};

interface Props {
  shape: GarmentShape;
  /** Garment colour as a hex string; the outline is filled with it. */
  hex: string;
  side: 'front' | 'back';
  className?: string;
}

/**
 * A flat garment silhouette filled in the chosen colour. Rendered behind the
 * print area on the Customize screen.
 */
export function GarmentOutline({ shape, hex, side, className }: Props) {
  // Pale garments need a visible edge; dark ones read fine against the canvas.
  const stroke = isLight(hex) ? '#9aa0a6' : 'rgba(255,255,255,0.35)';

  return (
    <svg
      viewBox="0 0 1000 1200"
      className={className}
      role="img"
      aria-label={`${shape} ${side}`}
    >
      <path d={BODY[shape]} fill={hex} stroke={stroke} strokeWidth={4} />

      {/* Neckline: a collar band on the front, a wider yoke seam on the back. */}
      {side === 'front' ? (
        <path
          d="M 380 170 C 400 240 600 240 620 170"
          fill="none"
          stroke={stroke}
          strokeWidth={14}
        />
      ) : (
        <path
          d="M 360 180 C 420 215 580 215 640 180"
          fill="none"
          stroke={stroke}
          strokeWidth={10}
        />
      )}

      {/* Kangaroo pocket, hoodies only, and only on the front. */}
      {shape === 'hoodie' && side === 'front' && (
        <path
          d="M 300 830 L 700 830 L 660 990 L 340 990 Z"
          fill="none"
          stroke={stroke}
          strokeWidth={6}
        />
      )}

      {/* Hood, drawn behind the shoulders. */}
      {shape === 'hoodie' && (
        <path
          d="M 380 170 C 340 60 660 60 620 170"
          fill="none"
          stroke={stroke}
          strokeWidth={16}
        />
      )}
    </svg>
  );
}

/** Perceived luminance, used to pick a stroke that stays visible. */
function isLight(hex: string): boolean {
  const v = hex.replace('#', '');
  if (v.length !== 6) return true;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
