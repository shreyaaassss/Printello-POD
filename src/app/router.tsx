import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from './AppLayout';
import { RequireAuth } from '../features/auth/RequireAuth';
import { RequireAdmin } from '../features/admin/RequireAdmin';
import { LoginPage } from '../pages/LoginPage';
import { AuthCallbackPage } from '../pages/AuthCallbackPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';

/**
 * Login and the OAuth callback sit outside the guard; everything else is
 * behind it. Each remaining placeholder names the phase that fills it in.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'designs', element: <PlaceholderPage title="My Designs" phase="2" /> },
          { path: 'create', element: <PlaceholderPage title="Create Product" phase="3a" /> },
          { path: 'create/:slug', element: <PlaceholderPage title="Customize" phase="3b" /> },
          { path: 'cart', element: <PlaceholderPage title="Cart" phase="4" /> },
          { path: 'checkout', element: <PlaceholderPage title="Checkout" phase="4" /> },
          { path: 'orders', element: <PlaceholderPage title="My Orders" phase="5" /> },
          {
            element: <RequireAdmin />,
            children: [{ path: 'admin', element: <PlaceholderPage title="Admin" phase="5" /> }],
          },
          { path: '*', element: <PlaceholderPage title="Not found" phase="—" /> },
        ],
      },
    ],
  },
]);
