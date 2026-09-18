import type { PrintArea } from '../../types/catalogue';

/**
 * Where a design sits inside a print area.
 *
 * Everything is expressed as a fraction of the print area, never in pixels or
 * inches, so one stored record renders identically in a 300px preview and in a
 * 4000px print file. The print area's own size can also change — and the
 * seeded geometry is still a placeholder that will change — without
 * invalidating placements already saved against it.
 *
 *  - `x`, `y`   centre of the design, 0..1 across the print area
 *  - `scale`    design width as a fraction of the print area width
 *  - `rotation` degrees; carried through but not yet exposed in the UI
 */
export interface Placement {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const DEFAULT_PLACEMENT: Placement = { x: 0.5, y: 0.5, scale: 1, rotation: 0 };

/** Target print resolution. Matches the DTF site's threshold. */
export const DPI_OK = 300;

/** Below this the design is too small to position meaningfully. */
export const MIN_SCALE = 0.05;

/**
 * Largest scale at which the design still fits entirely inside the print area.
 *
 * Containment is enforced by construction rather than validated afterwards:
 * artwork that overhangs the printable area cannot be produced, so the UI
 * simply never allows it. `aspect` is design width / height.
 */
export function maxScale(area: PrintArea, aspect: number): number {
  if (!(aspect > 0)) return 1;
  // Width-limited at 1; height-limited when the design is taller than the area.
  const heightLimited = (area.height * aspect) / area.width;
  return Math.min(1, heightLimited);
}

/** Design size in print-area units at a given scale. */
export function designSize(area: PrintArea, aspect: number, scale: number) {
  const width = scale * area.width;
  const height = aspect > 0 ? width / aspect : 0;
  return { width, height };
}

/**
 * Clamp a placement so the design stays wholly inside the print area, and the
 * scale stays within what fits. Idempotent: clamping a clamped placement is a
 * no-op, which is what lets it run on every drag frame.
 */
export function clampPlacement(
  area: PrintArea,
  aspect: number,
  placement: Placement,
): Placement {
  const scale = clamp(placement.scale, MIN_SCALE, maxScale(area, aspect));
  const { width, height } = designSize(area, aspect, scale);

  // Half the design, as a fraction of the area, is the margin the centre must
  // keep from each edge.
  const halfX = width / 2 / area.width;
  const halfY = height / 2 / area.height;

  return {
    scale,
    rotation: placement.rotation,
    // When the design exactly fills an axis the bounds collapse to a point;
    // min > max would otherwise invert and push it off-centre.
    x: halfX * 2 >= 1 ? 0.5 : clamp(placement.x, halfX, 1 - halfX),
    y: halfY * 2 >= 1 ? 0.5 : clamp(placement.y, halfY, 1 - halfY),
  };
}

/** Centred, as large as it fits. The placement a newly chosen design gets. */
export function fitPlacement(area: PrintArea, aspect: number): Placement {
  return clampPlacement(area, aspect, { ...DEFAULT_PLACEMENT, scale: maxScale(area, aspect) });
}

/** The design's rectangle in the outline image's coordinate space, for rendering. */
export function placementRect(area: PrintArea, aspect: number, placement: Placement) {
  const { width, height } = designSize(area, aspect, placement.scale);
  return {
    x: area.x + placement.x * area.width - width / 2,
    y: area.y + placement.y * area.height - height / 2,
    width,
    height,
  };
}

/** Printed size of the design in inches. */
export function printedInches(area: PrintArea, aspect: number, placement: Placement) {
  const width = placement.scale * area.widthIn;
  const height = aspect > 0 ? width / aspect : 0;
  return { width, height };
}

/**
 * Effective print resolution: the design's own pixels spread across the inches
 * it is printed at. Scaling a design up lowers this — which is the whole point
 * of showing it live rather than checking once at upload.
 */
export function effectiveDpi(
  area: PrintArea,
  designWidthPx: number,
  aspect: number,
  placement: Placement,
): number {
  const { width } = printedInches(area, aspect, placement);
  if (width <= 0) return 0;
  return designWidthPx / width;
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.min(hi, Math.max(lo, v));
}

/** Which corner of the artwork is being dragged. */
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** The artwork's edges, as fractions of the print area. */
export function placementBounds(area: PrintArea, aspect: number, placement: Placement) {
  const w = placement.scale;
  const { height } = designSize(area, aspect, placement.scale);
  const h = area.height > 0 ? height / area.height : 0;
  return {
    left: placement.x - w / 2,
    right: placement.x + w / 2,
    top: placement.y - h / 2,
    bottom: placement.y + h / 2,
    w,
    h,
  };
}

/**
 * Resize by dragging a corner, keeping the opposite corner pinned — the
 * behaviour of every image editor, and what makes the handle feel attached to
 * the artwork rather than to a slider somewhere else.
 *
 * `pointerX/Y` are in print-area fractions. Aspect ratio is locked, so the
 * drag is driven by width and the height follows; dragging inward past
 * MIN_SCALE stops rather than inverting the artwork.
 */
export function resizeFromCorner(
  area: PrintArea,
  aspect: number,
  placement: Placement,
  corner: Corner,
  pointerX: number,
  pointerY: number,
): Placement {
  const b = placementBounds(area, aspect, placement);
  const east = corner === 'ne' || corner === 'se';
  const south = corner === 'se' || corner === 'sw';

  // Scale implied by each axis, measured from the pinned edge. Taking the
  // larger means a purely vertical drag still resizes — driving off width
  // alone makes the handle feel stuck when dragged downward.
  const widthImplied = east ? pointerX - b.left : b.right - pointerX;
  const heightFraction = south ? pointerY - b.top : b.bottom - pointerY;
  const heightImplied =
    aspect > 0 && area.width > 0
      ? (heightFraction * area.height * aspect) / area.width
      : 0;

  const scale = Math.min(
    Math.max(widthImplied, heightImplied, MIN_SCALE),
    maxScale(area, aspect),
  );

  const { height } = designSize(area, aspect, scale);
  const h = area.height > 0 ? height / area.height : 0;

  // Pin the opposite corner: the edges the drag is not touching stay put.
  const x = east ? b.left + scale / 2 : b.right - scale / 2;
  const y = south ? b.top + h / 2 : b.bottom - h / 2;

  return clampPlacement(area, aspect, { ...placement, x, y, scale });
}
