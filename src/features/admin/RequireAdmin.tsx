import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { AuthPending } from '../auth/RequireAuth';

/**
 * Gate for staff routes. This only decides what to *render* — the real boundary
 * is row-level security, which returns nothing to a non-admin however they ask.
 */
export function RequireAdmin() {
  const { session, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading || (session && isAdmin === null)) return <AuthPending />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
