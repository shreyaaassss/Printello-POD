import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/designs', label: 'My Designs' },
  { to: '/create', label: 'Create Product' },
  { to: '/cart', label: 'Cart' },
  { to: '/orders', label: 'My Orders' },
  { to: '/admin', label: 'Admin' },
];

/** Dashboard chrome: fixed sidebar, header, routed content. */
export function AppLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r border-brand-100 bg-white">
        <div className="px-6 py-5 text-lg font-semibold text-brand-700">Printello POD</div>
        <nav className="flex flex-col gap-1 px-3">
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
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-brand-100 bg-white px-8 py-4">
          <span className="text-sm text-muted">Demo build</span>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
