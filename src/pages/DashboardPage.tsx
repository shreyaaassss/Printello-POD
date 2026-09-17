import { useEffect } from 'react';

import { useAuth } from '../features/auth/AuthProvider';
import { displayName } from '../features/auth/auth';
import { useProfile } from '../features/profile/useProfile';

/**
 * Phase 1 home. Order counters and analytics arrive in phase 6 — for now this
 * confirms the session and the profile row the signup trigger created.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { profile, loading, error } = useProfile(user?.id ?? null);

  useEffect(() => {
    document.title = 'Dashboard | Printello POD';
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">
        {user ? `Welcome, ${displayName(user)}` : 'Dashboard'}
      </h1>
      <p className="mt-2 text-muted">Upload a design, then build a product from it.</p>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Account
        </h2>
        {loading && <p className="mt-3 text-sm text-muted">Loading profile…</p>}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {!loading && !error && (
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Email" value={profile?.email ?? user?.email ?? '—'} />
            <Row label="Name" value={profile?.fullName ?? '—'} />
            <Row label="Business" value={profile?.businessName ?? 'Not set'} />
            <Row label="Phone" value={profile?.phone ?? 'Not set'} />
          </dl>
        )}
        {!loading && !error && !profile && (
          <p className="mt-3 text-sm text-amber-800">
            No profile row found. The signup trigger should have created one —
            worth checking <code>on_auth_user_created</code>.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted">{label}:</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
