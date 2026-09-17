/**
 * Verifies the artwork placement geometry against the real module — Node 26
 * runs TypeScript directly, so this imports `src/` rather than reimplementing
 * it. A reimplementation can agree with itself while both are wrong.
 *
 *   node scripts/check-placement.mts
 *
 * Relative imports need the explicit .ts extension.
 */
import {
  clampPlacement,
  designSize,
  effectiveDpi,
  fitPlacement,
  maxScale,
  placementRect,
  printedInches,
  type Placement,
} from '../src/features/customize/placement.ts';
import type { PrintArea } from '../src/types/catalogue.ts';

// The seeded tee front: 380x507 px of a 1000x1200 outline, printed 12in x 16in.
const AREA: PrintArea = {
  id: 'a', productId: 'p', side: 'front',
  imageWidth: 1000, imageHeight: 1200,
  x: 310, y: 420, width: 380, height: 507,
  widthIn: 12, heightIn: 16,
};

let failures = 0;
function check(label: string, got: unknown, want: unknown, tol = 1e-6) {
  const ok =
    typeof got === 'number' && typeof want === 'number'
      ? Math.abs(got - want) <= tol
      : JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${label}\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`);
  } else {
    console.log(`  ok    ${label}`);
  }
}
function checkTrue(label: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`  FAIL  ${label} ${detail}`); }
  else console.log(`  ok    ${label}`);
}

console.log('maxScale — which axis limits the fit');
// Square and wide designs are limited by width, so they cap at 1.
check('square caps at 1', maxScale(AREA, 1), 1);
check('3:1 wide caps at 1', maxScale(AREA, 3), 1);
// A 1:2 design is limited by height: 507 * 0.5 / 380.
check('1:2 tall is height-limited', maxScale(AREA, 0.5), (507 * 0.5) / 380);
check('degenerate aspect falls back to 1', maxScale(AREA, 0), 1);

console.log('\nfit — a newly chosen design is centred and as large as it fits');
{
  const p = fitPlacement(AREA, 0.5);
  check('tall design centred x', p.x, 0.5);
  check('tall design centred y', p.y, 0.5);
  const r = placementRect(AREA, 0.5, p);
  checkTrue('fits inside horizontally', r.x >= AREA.x - 1e-9 && r.x + r.width <= AREA.x + AREA.width + 1e-9);
  checkTrue('fits inside vertically', r.y >= AREA.y - 1e-9 && r.y + r.height <= AREA.y + AREA.height + 1e-9);
  check('height fills the area', designSize(AREA, 0.5, p.scale).height, AREA.height, 1e-9);
}

console.log('\nclamp — containment is enforced, not validated');
{
  // Dragged hard to the top-left at half scale: the centre must stop half a
  // design-width from each edge, not at the edge itself.
  const p = clampPlacement(AREA, 1, { x: -5, y: -5, scale: 0.5, rotation: 0 });
  check('x stops at half the design width', p.x, 0.25);
  check('y stops at half the design height', p.y, (0.5 * 380) / 2 / 507);
  const r = placementRect(AREA, 1, p);
  checkTrue('still inside after extreme drag', r.x >= AREA.x - 1e-9 && r.y >= AREA.y - 1e-9);
}
{
  // A design that exactly fills an axis has nowhere to go on it: the bounds
  // collapse to a point, and must not invert.
  const p = clampPlacement(AREA, 1, { x: 0, y: 0.9, scale: 1, rotation: 0 });
  check('full-width design is pinned to centre x', p.x, 0.5);
}
{
  // Oversized requests are capped rather than rejected.
  const p = clampPlacement(AREA, 0.5, { x: 0.5, y: 0.5, scale: 9, rotation: 0 });
  check('scale capped at what fits', p.scale, maxScale(AREA, 0.5));
}
{
  // Idempotence is what lets clamp run on every pointer frame.
  const once = clampPlacement(AREA, 1.4, { x: 0.02, y: 0.98, scale: 3, rotation: 0 });
  const twice = clampPlacement(AREA, 1.4, once);
  check('clamping twice changes nothing', twice, once);
}

console.log('\nDPI — scaling up is what makes a design soft');
{
  const full: Placement = { x: 0.5, y: 0.5, scale: 1, rotation: 0 };
  // 3600px across a 12in area is exactly 300 DPI.
  check('3600px at full width is 300 DPI', effectiveDpi(AREA, 3600, 1, full), 300);
  const half: Placement = { ...full, scale: 0.5 };
  check('same file at half width doubles DPI', effectiveDpi(AREA, 3600, 1, half), 600);
  check('printed width follows scale', printedInches(AREA, 1, half).width, 6);
  // A small file blown up across the full area goes soft — the case the
  // warning exists for.
  checkTrue('900px across 12in is under 300 DPI', effectiveDpi(AREA, 900, 1, full) < 300,
    `(got ${effectiveDpi(AREA, 900, 1, full).toFixed(0)})`);
}

console.log('\nhoodie front (migration 0006) — shorter area changes the fit');
{
  const hoodie: PrintArea = { ...AREA, y: 380, height: 400, heightIn: 12.6 };
  const p = fitPlacement(hoodie, 1);
  const r = placementRect(hoodie, 1, p);
  checkTrue('square design fits the shorter area',
    r.y >= hoodie.y - 1e-9 && r.y + r.height <= hoodie.y + hoodie.height + 1e-9);
  // 400/380 exceeds 1, so a square is still WIDTH-limited: scale never goes
  // above 1 because the design must not be wider than the area.
  check('square is width-limited even here', maxScale(hoodie, 1), 1);
  // A 4:5 design is taller than it is wide, so the shorter area binds.
  check('4:5 design is height-limited', maxScale(hoodie, 0.8), (400 * 0.8) / 380);
  const tall = fitPlacement(hoodie, 0.8);
  const tr = placementRect(hoodie, 0.8, tall);
  checkTrue('4:5 design fits the shorter area',
    tr.y >= hoodie.y - 1e-9 && tr.y + tr.height <= hoodie.y + hoodie.height + 1e-9);
}

console.log(failures === 0 ? '\nPASS — all placement checks' : `\nFAILED — ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
