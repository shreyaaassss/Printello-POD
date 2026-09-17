/**
 * India Post's public PIN code directory. No key, no billing, and it sends
 * `access-control-allow-origin: *`, so the browser can call it directly.
 *
 * This isn't society-level autocomplete — it resolves a PIN code to its district,
 * state and the post-office localities inside it, which is enough to stop the
 * address disagreeing with the PIN code we quote shipping against.
 */

const ENDPOINT = 'https://api.postalpincode.in/pincode';

export interface PincodeInfo {
  city: string;
  state: string;
  /** Localities served by this PIN code, for the area/landmark field. */
  localities: string[];
}

interface PostOffice {
  Name?: string;
  District?: string;
  State?: string;
}

interface LookupEntry {
  Status?: string;
  PostOffice?: PostOffice[] | null;
}

export async function lookupPincode(
  pincode: string,
  signal?: AbortSignal,
): Promise<PincodeInfo | null> {
  const response = await fetch(`${ENDPOINT}/${pincode}`, { signal });
  if (!response.ok) throw new Error('Could not look up that PIN code');

  const body = (await response.json()) as LookupEntry[];
  const entry = body?.[0];
  const offices = entry?.PostOffice ?? [];
  if (entry?.Status !== 'Success' || offices.length === 0) return null;

  const localities = [...new Set(offices.map((o) => o.Name).filter((n): n is string => !!n))];

  return {
    city: offices[0].District ?? '',
    state: offices[0].State ?? '',
    localities,
  };
}
