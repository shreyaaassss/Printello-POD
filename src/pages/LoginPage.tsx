import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../features/auth/AuthProvider';
import { AuthPending } from '../features/auth/RequireAuth';
import { DEFAULT_SIGNED_IN_PATH, signInWithGoogle } from '../features/auth/auth';

export function LoginPage() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Sign in | Printello POD';
  }, []);

  // Where the guard bounced us from, so sign-in returns there.
  const from = (location.state as { from?: string } | null)?.from;

  if (loading) return <AuthPending />;
  if (session) return <Navigate to={from ?? DEFAULT_SIGNED_IN_PATH} replace />;

  async function onGoogle() {
    setBusy(true);
    setError(null);
    const { error: err } = await signInWithGoogle(from);
    // On success the browser has already navigated to Google, so reaching here
    // with no error only happens if the redirect was blocked.
    if (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-brand-700">Printello POD</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to upload artwork and place orders.
        </p>

        {!isSupabaseConfigured && (
          <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Supabase credentials are missing. Set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then restart
            the dev server — Vite reads them at startup.
          </p>
        )}

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy || !isSupabaseConfigured}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
      </div>
    </div>
  );
}
