import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from './AppLayout';
import { RequireAuth } from '../features/auth/RequireAuth';
import { RequireAdmin } from '../features/admin/RequireAdmin';
import { LoginPage } from '../pages/LoginPage';
import { AuthCallbackPage } from '../pages/AuthCallbackPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { GarmentPreviewDevPage } from '../pages/GarmentPreviewDevPage';
import { DesignsPage } from '../pages/DesignsPage';
import { CreateProductPage } from '../pages/CreateProductPage';
import { CustomizePage } from '../pages/CustomizePage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';

/**
 * Login and the OAuth callback sit outside the guard; everything else is
 * behind it. Each remaining placeholder names the phase that fills it in.
 */
export const router = createBrowserRouter([
  // Visual check for the hand-drawn garment shapes. Dev only: it is not
  // behind the auth guard, so it must never exist in a build.
  ...(import.meta.env.DEV
    ? [{ path: '/__garments', element: <GarmentPreviewDevPage /> }]
    : []),
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
          { path: 'designs', element: <DesignsPage /> },
          { path: 'create', element: <CreateProductPage /> },
          { path: 'create/:slug', element: <CustomizePage /> },
          { path: 'cart', element: <CartPage /> },
          { path: 'checkout', element: <CheckoutPage /> },
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
