import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '../../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup resolves. Guards redirect on refresh. */
  loading: boolean;
  /** Whether this account is staff. Null until the check resolves. */
  isAdmin: boolean | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // With no credentials there is nothing to look up, so never start in loading.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    // getSession() awaits the client's initialization, and that initialization
    // is what consumes the ?code= param after an OAuth redirect — so this one
    // call settles the callback case too.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Never await a Supabase call inside this callback: auth-js invokes it
    // while holding its internal lock, and a re-entrant call can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Resolved in its own effect, keyed on the user id: never inside
  // onAuthStateChange, where a re-entrant Supabase call can deadlock, and never
  // keyed on the user object, which changes identity on every token refresh.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    void supabase.rpc('is_admin').then(({ data, error }) => {
      if (!active) return;
      // Failing closed matters more than reporting the error: staff can retry,
      // but a seller must never be handed the fulfilment view.
      setIsAdmin(error ? false : data === true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const value = useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, loading, isAdmin }),
    [session, loading, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
