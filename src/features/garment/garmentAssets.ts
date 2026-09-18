import { supabase } from '../../lib/supabase';
import type { ProductColour, PrintSide } from '../../types/catalogue';

export const GARMENTS_BUCKET = 'garments';

/**
 * Public URL of the flat outline for one colour and side, or null when no
 * asset has been uploaded for it.
 *
 * The bucket is public, so this is a plain URL rather than a signed one —
 * garment outlines are reference data shown to every seller, unlike the
 * artwork in `designs`.
 */
export function garmentOutlineUrl(
  colour: ProductColour | null,
  side: PrintSide,
): string | null {
  const path = side === 'front' ? colour?.frontImagePath : colour?.backImagePath;
  if (!path) return null;
  return supabase.storage.from(GARMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
}
