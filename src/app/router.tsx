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
import { OrdersPage } from '../pages/OrdersPage';
import { OrderDetailPage } from '../pages/OrderDetailPage';
import { AdminOrdersPage } from '../pages/AdminOrdersPage';

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
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
          {
            element: <RequireAdmin />,
            children: [{ path: 'admin', element: <AdminOrdersPage /> }],
          },
          { path: '*', element: <PlaceholderPage title="Not found" phase="—" /> },
        ],
      },
    ],
  },
]);
