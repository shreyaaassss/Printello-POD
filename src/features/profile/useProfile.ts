import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';

export interface Profile {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  businessName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

/**
 * The seller's profile row. Created by the `on_auth_user_created` trigger, so
 * it exists by the time a session does — but a row can still be missing if the
 * account predates the trigger, which is why `profile` is nullable rather than
 * assumed.
 */
export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    void supabase
      .from('profiles')
      .select(
        'id, email, full_name, avatar_url, phone, business_name, address_line1, address_line2, city, state, pincode',
      )
      .eq('id', userId)
      // maybeSingle, not single: a missing row is a state to handle, not an error.
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) {
          setError(err.message);
          setProfile(null);
        } else if (data) {
          setError(null);
          setProfile({
            id: data.id,
            email: data.email,
            fullName: data.full_name,
            avatarUrl: data.avatar_url,
            phone: data.phone,
            businessName: data.business_name,
            addressLine1: data.address_line1,
            addressLine2: data.address_line2,
            city: data.city,
            state: data.state,
            pincode: data.pincode,
          });
        } else {
          setError(null);
          setProfile(null);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return { profile, loading, error };
}
