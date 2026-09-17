/**
 * Client-side inspection of an uploaded artwork file.
 *
 * Two things matter for garment printing, and only one of them is DPI:
 *
 *  - **Resolution** decides whether the print looks soft. It is only meaningful
 *    against a physical size, so this module reports pixels and leaves the DPI
 *    judgement to whoever knows the print area (see `maxPrintInches`).
 *  - **Transparency** decides whether the print has a white box around it. A
 *    JPEG has no alpha channel at all, so artwork saved as JPEG prints its
 *    background as ink — obvious on a black tee, and unfixable at the press.
 *    A resolution warning cannot catch this, which is why it is checked here.
 */

/** Below this, a pixel counts as meaningfully transparent rather than rounding noise. */
const ALPHA_THRESHOLD = 250;

/** Longest edge used for the sampling canvas. Big enough to spot real transparency. */
const SAMPLE_MAX_EDGE = 256;

export interface ImageProbe {
  width: number;
  height: number;
  /** True if any sampled pixel is meaningfully transparent. */
  hasTransparency: boolean;
  /** True if all four corners are transparent — the usual shape of good artwork. */
  cornersTransparent: boolean;
}

export class ImageProbeError extends Error {}

/**
 * Decode `file` and measure it. Throws `ImageProbeError` if the bytes are not a
 * decodable image, which is the only way to be sure — extension and MIME type
 * are both caller-supplied and neither proves the content.
 */
export async function probeImage(file: File): Promise<ImageProbe> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageProbeError('That file could not be read as an image.');
  }

  try {
    const { width, height } = bitmap;
    if (!width || !height) {
      throw new ImageProbeError('That image reports a zero width or height.');
    }

    // Sample at reduced size: we are asking whether transparency exists at all,
    // not measuring it precisely, and full-size getImageData on a 30MP print
    // file is slow enough to lock the tab.
    const scale = Math.min(1, SAMPLE_MAX_EDGE / Math.max(width, height));
    const sw = Math.max(1, Math.round(width * scale));
    const sh = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new ImageProbeError('Could not inspect the image in this browser.');

    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(bitmap, 0, 0, sw, sh);

    const { data } = ctx.getImageData(0, 0, sw, sh);

    let hasTransparency = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < ALPHA_THRESHOLD) {
        hasTransparency = true;
        break;
      }
    }

    const cornerAlpha = [
      alphaAt(data, sw, 0, 0),
      alphaAt(data, sw, sw - 1, 0),
      alphaAt(data, sw, 0, sh - 1),
      alphaAt(data, sw, sw - 1, sh - 1),
    ];
    const cornersTransparent = cornerAlpha.every((a) => a < ALPHA_THRESHOLD);

    return { width, height, hasTransparency, cornersTransparent };
  } finally {
    bitmap.close();
  }
}

function alphaAt(data: Uint8ClampedArray, rowWidth: number, x: number, y: number): number {
  return data[(y * rowWidth + x) * 4 + 3];
}

/** Target resolution for a good print. Matches the DTF site's threshold. */
export const DPI_OK = 300;

/**
 * The largest size this artwork prints at without going soft, in inches.
 * Reported rather than judged: whether it is enough depends on the print area,
 * which this module deliberately knows nothing about.
 */
export function maxPrintInches(widthPx: number, heightPx: number) {
  return { width: widthPx / DPI_OK, height: heightPx / DPI_OK };
}

/** Effective DPI when `widthPx` is printed across `inches`. */
export function effectiveDpi(widthPx: number, inches: number): number {
  if (inches <= 0) return 0;
  return widthPx / inches;
}
