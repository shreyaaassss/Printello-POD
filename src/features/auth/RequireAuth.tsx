import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthProvider';

/** Full-page holding state, so a refresh on a protected route doesn't flash login. */
export function AuthPending({ label = 'Checking your session…' }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthPending />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
