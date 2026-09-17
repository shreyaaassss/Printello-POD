import { supabase } from '../../lib/supabase';
import { probeImage } from '../../lib/imageProbe';

export const DESIGNS_BUCKET = 'designs';

/** POD India accepts JPG and PNG only; matching that keeps the print side simple. */
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg'] as const;
export const ACCEPT_ATTR = '.png,.jpg,.jpeg';

/** Print-resolution artwork is large, but 40MB is past what a browser upload handles well. */
export const MAX_BYTES = 40 * 1024 * 1024;

export interface Design {
  id: string;
  name: string;
  storagePath: string;
  mimeType: string | null;
  widthPx: number | null;
  heightPx: number | null;
  bytes: number | null;
  createdAt: string;
}

export class UploadError extends Error {}

interface UploadResult {
  design: Design;
  /** True when the artwork has no transparent pixels — it will print a filled box. */
  opaque: boolean;
}

/**
 * Validate, measure and store one artwork file.
 *
 * Storage first, row second: an orphaned object is invisible and cheap, while
 * an orphaned row renders as a broken thumbnail in the library. If the insert
 * fails the object is removed, so the common case leaves nothing behind.
 */
export async function uploadDesign(userId: string, file: File): Promise<UploadResult> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    throw new UploadError('Only JPG and PNG files are supported.');
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError(
      `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)}.`,
    );
  }

  // Decode before uploading: this is also what rejects a file that is named
  // .png but is not an image.
  const probe = await probeImage(file);

  const id = crypto.randomUUID();
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  // The first path segment is the ownership check in the storage policy.
  const storagePath = `${userId}/${id}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(DESIGNS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadErr) throw new UploadError(uploadErr.message);

  const { data, error: insertErr } = await supabase
    .from('designs')
    .insert({
      id,
      user_id: userId,
      name: cleanName(file.name),
      storage_path: storagePath,
      mime_type: file.type,
      width_px: probe.width,
      height_px: probe.height,
      bytes: file.size,
    })
    .select('id, name, storage_path, mime_type, width_px, height_px, bytes, created_at')
    .single();

  if (insertErr || !data) {
    // Best effort: if this also fails the object is orphaned but harmless.
    await supabase.storage.from(DESIGNS_BUCKET).remove([storagePath]);
    throw new UploadError(insertErr?.message ?? 'Could not save the design.');
  }

  return { design: toDesign(data), opaque: !probe.hasTransparency };
}

export async function listDesigns(userId: string): Promise<Design[]> {
  const { data, error } = await supabase
    .from('designs')
    .select('id, name, storage_path, mime_type, width_px, height_px, bytes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toDesign);
}

/** Remove the row and the object. The row goes first so a failure cannot leave
 *  a design listed with its pixels already deleted. */
export async function deleteDesign(design: Design): Promise<void> {
  const { error } = await supabase.from('designs').delete().eq('id', design.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(DESIGNS_BUCKET).remove([design.storagePath]);
}

export async function renameDesign(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('A design needs a name.');
  const { error } = await supabase.from('designs').update({ name: trimmed }).eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Signed URLs for a batch of designs. The bucket is private, so thumbnails
 * cannot be plain public URLs; these expire and are re-minted on each load.
 */
export async function signThumbnails(
  designs: Design[],
  expiresInSeconds = 60 * 60,
): Promise<Record<string, string>> {
  if (designs.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(DESIGNS_BUCKET)
    .createSignedUrls(
      designs.map((d) => d.storagePath),
      expiresInSeconds,
    );
  if (error) throw new Error(error.message);

  const byPath = new Map((data ?? []).map((r) => [r.path, r.signedUrl]));
  const out: Record<string, string> = {};
  for (const d of designs) {
    const url = byPath.get(d.storagePath);
    if (url) out[d.id] = url;
  }
  return out;
}

function toDesign(row: {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
  bytes: number | null;
  created_at: string;
}): Design {
  return {
    id: row.id,
    name: row.name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    widthPx: row.width_px,
    heightPx: row.height_px,
    bytes: row.bytes,
    createdAt: row.created_at,
  };
}

/** Strip the extension so the library reads as names, not filenames. */
function cleanName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').trim();
  return base.slice(0, 120) || 'Untitled design';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
