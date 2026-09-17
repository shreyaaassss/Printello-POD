import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider';
import { avatarUrl, displayName, initials, signOut } from '../features/auth/auth';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/designs', label: 'My Designs' },
  { to: '/create', label: 'Create Product' },
  { to: '/cart', label: 'Cart' },
  { to: '/orders', label: 'My Orders' },
];

/** Dashboard chrome: sidebar, account header, routed content. */
export function AppLayout() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    // onAuthStateChange clears the session, but navigate explicitly so the user
    // isn't left on a guarded route waiting for the guard to bounce them.
    navigate('/login', { replace: true });
  }

  const avatar = user ? avatarUrl(user) : null;

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-brand-100 bg-white">
        <div className="px-6 py-5 text-lg font-semibold text-brand-700">Printello POD</div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-600 text-white' : 'text-muted hover:bg-brand-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {/* Staff only. Hiding it is presentation; RLS is the real boundary. */}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `mt-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-900 text-white' : 'text-muted hover:bg-brand-50'
                }`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>

        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="m-3 rounded-full px-4 py-2.5 text-left text-sm font-medium text-muted transition hover:bg-brand-50 disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Log Out'}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-brand-100 bg-white px-8 py-3">
          {user && (
            <>
              <span className="text-sm font-medium text-ink">{displayName(user)}</span>
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                  {initials(user)}
                </span>
              )}
            </>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
