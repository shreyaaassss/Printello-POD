import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider';
import { AuthPending } from '../features/auth/RequireAuth';
import { takeNextPath } from '../features/auth/auth';

/**
 * Landing point for the OAuth redirect. The provider's `getSession()` is what
 * exchanges the `?code=` param, so this page only waits for that to settle and
 * then forwards to wherever the user was heading.
 */
export function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    // Replace, so the callback URL — which still carries the code — never ends
    // up in history where a back button would replay it.
    navigate(session ? takeNextPath() : '/login', { replace: true });
  }, [loading, session, navigate]);

  return <AuthPending label="Signing you in…" />;
}
