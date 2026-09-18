/**
 * Flat technical-sketch garment outlines, drawn in the same 1000x1200
 * coordinate space that `print_areas` records its rectangles in.
 *
 * These are a stand-in for real tech-pack artwork. When a flat outline is
 * uploaded to the `garments` bucket and `product_colours.*_image_path` is set,
 * `GarmentPreview` shows that image instead and these are never rendered.
 */

export type GarmentShape = 'tee' | 'longsleeve' | 'hoodie';

export function shapeForSlug(slug: string): GarmentShape {
  if (slug.includes('hoodie')) return 'hoodie';
  if (slug.includes('sweatshirt')) return 'longsleeve';
  return 'tee';
}

/**
 * Silhouette stroke. Deliberately one neutral grey for every garment colour:
 * this edge borders the page, not the garment, so a colour chosen to contrast
 * with the fill disappears against the background.
 */
const EDGE = '#8a9199';
const EDGE_W = 3;

const TEE_BODY =
  'M 400 186 C 430 250 570 250 600 186 L 705 212 L 852 292 L 792 438 ' +
  'L 735 404 L 735 1046 L 265 1046 L 265 404 L 208 438 L 148 292 L 295 212 Z';

// Arms are drawn as actual limbs — outer edge down to a cuff, then back up
// the inner edge to the armpit. Running one wide trapezoid from shoulder to
// hem, as this did first, reads as a boxy short-sleeve top with no arms.
const SLEEVE_BODY =
  'M 400 194 C 430 258 570 258 600 194 ' +
  'L 702 230 L 876 556 L 846 716 L 756 692 L 730 474 ' +
  'L 730 1000 L 270 1000 L 270 474 L 244 692 L 154 716 L 124 556 L 298 230 Z';

const BODY: Record<GarmentShape, string> = {
  tee: TEE_BODY,
  longsleeve: SLEEVE_BODY,
  hoodie: SLEEVE_BODY,
};

interface Props {
  shape: GarmentShape;
  hex: string;
  side: 'front' | 'back';
  className?: string;
}

export function GarmentOutline({ shape, hex, side, className }: Props) {
  // Seams sit *on* the garment, so they are derived from the fill rather than
  // picked from a fixed pair — a fixed light grey vanished on Grey Melange,
  // which sits at the lightness threshold and happened to match it.
  const seam = contrastingInk(hex);
  const longSleeved = shape !== 'tee';

  return (
    <svg viewBox="0 0 1000 1200" className={className} role="img" aria-label={`${shape} ${side}`}>
      {/* Hood behind the shoulders. Filled in the garment colour and outlined
          in EDGE because it extends past the body onto the page. */}
      {shape === 'hoodie' && (
        <>
          <path
            d="M 372 232 C 336 44 664 44 628 232 C 580 168 420 168 372 232 Z"
            fill={hex}
            stroke={EDGE}
            strokeWidth={EDGE_W}
            strokeLinejoin="round"
          />
          {side === 'front' && (
            <path
              d="M 396 210 C 440 258 560 258 604 210"
              fill="none"
              stroke={seam}
              strokeWidth={2.5}
              strokeDasharray="9 7"
            />
          )}
        </>
      )}

      <path d={BODY[shape]} fill={hex} stroke={EDGE} strokeWidth={EDGE_W} strokeLinejoin="round" />

      {/* Collar. A tee gets a plain band; a fleece garment gets ribbing. */}
      {longSleeved ? (
        <Ribbing
          d="M 400 190 C 430 254 570 254 600 190"
          outer="M 384 182 C 420 268 580 268 616 182"
          seam={seam}
          count={16}
        />
      ) : (
        <>
          <path
            d="M 400 186 C 430 250 570 250 600 186"
            fill="none"
            stroke={seam}
            strokeWidth={2.5}
          />
          <path
            d="M 388 178 C 422 264 578 264 612 178"
            fill="none"
            stroke={seam}
            strokeWidth={2.5}
          />
        </>
      )}

      {/* Shoulder seams. */}
      <path d="M 400 190 L 296 216" fill="none" stroke={seam} strokeWidth={2.5} />
      <path d="M 600 190 L 704 216" fill="none" stroke={seam} strokeWidth={2.5} />

      {/* Sleeve hems: a stitched cuff on a tee, a ribbed cuff on fleece. */}
      {longSleeved ? (
        <>
          {/* Cuffs, as their own outlined bands at the end of each arm. */}
          <path d="M 876 556 L 846 716 L 756 692 L 786 534 Z" fill="none" stroke={seam} strokeWidth={2.5} strokeLinejoin="round" />
          <path d="M 124 556 L 154 716 L 244 692 L 214 534 Z" fill="none" stroke={seam} strokeWidth={2.5} strokeLinejoin="round" />
          {/* Armhole seams. */}
          <path d="M 702 230 L 730 474" fill="none" stroke={seam} strokeWidth={2.5} strokeDasharray="9 7" />
          <path d="M 298 230 L 270 474" fill="none" stroke={seam} strokeWidth={2.5} strokeDasharray="9 7" />
        </>
      ) : (
        <>
          <path d="M 792 438 L 735 404" fill="none" stroke={seam} strokeWidth={2.5} strokeDasharray="9 7" />
          <path d="M 208 438 L 265 404" fill="none" stroke={seam} strokeWidth={2.5} strokeDasharray="9 7" />
        </>
      )}

      {/* Bottom hem. The ribbed band sits INSIDE the body — drawn below the
          hem line it reads as fringe hanging off the garment. */}
      {longSleeved ? (
        <g>
          <path d="M 270 938 L 730 938" fill="none" stroke={seam} strokeWidth={2.5} />
          {hatch(280, 720).map((x, i) => (
            <line key={i} x1={x} y1={944} x2={x} y2={994} stroke={seam} strokeWidth={1.6} opacity={0.6} />
          ))}
        </g>
      ) : (
        <path
          d="M 265 1006 L 735 1006"
          fill="none"
          stroke={seam}
          strokeWidth={2.5}
          strokeDasharray="9 7"
        />
      )}

      {/* Kangaroo pocket and drawstrings — the unmistakable hoodie cues. */}
      {shape === 'hoodie' && side === 'front' && (
        <>
          <path
            d="M 302 790 L 698 790 L 666 928 L 334 928 Z"
            fill="none"
            stroke={seam}
            strokeWidth={2.5}
            strokeDasharray="9 7"
            strokeLinejoin="round"
          />
          <g fill="none" stroke={seam} strokeWidth={6} strokeLinecap="round">
            <path d="M 452 244 L 442 366" />
            <path d="M 548 244 L 558 366" />
          </g>
          <circle cx={452} cy={238} r={7} fill="none" stroke={seam} strokeWidth={2.5} />
          <circle cx={548} cy={238} r={7} fill="none" stroke={seam} strokeWidth={2.5} />
        </>
      )}

      {/* Back yoke seam, so front and back are not the same picture. */}
      {side === 'back' && (
        <path
          d="M 330 250 C 430 300 570 300 670 250"
          fill="none"
          stroke={seam}
          strokeWidth={2.5}
          strokeDasharray="9 7"
        />
      )}
    </svg>
  );
}

/** Collar ribbing: two curves with hatching implied by a dash pattern. */
function Ribbing({
  d,
  outer,
  seam,
  count,
}: {
  d: string;
  outer: string;
  seam: string;
  count: number;
}) {
  return (
    <g fill="none" stroke={seam}>
      <path d={d} strokeWidth={2.5} />
      <path d={outer} strokeWidth={2.5} />
      {/* A dashed mid-line reads as rib texture without drawing every rib. */}
      <path d={outer} strokeWidth={10} strokeDasharray="2 8" opacity={0.5} />
      <desc>{count} ribs</desc>
    </g>
  );
}

/** Evenly spaced x positions for hatching a ribbed band. */
function hatch(from: number, to: number): number[] {
  const step = 16;
  const out: number[] = [];
  for (let x = from; x <= to; x += step) out.push(x);
  return out;
}

/** Perceived luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.6;
}

/**
 * A seam colour guaranteed to be visible on `hex`, by moving the garment
 * colour itself toward black or white. Mid-tones break fixed palettes.
 */
export function contrastingInk(hex: string): string {
  const [r, g, b] = rgb(hex);
  const towardWhite = luminance(hex) <= 0.6;
  const mix = (c: number) => Math.round(towardWhite ? c + (255 - c) * 0.5 : c * 0.5);
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
