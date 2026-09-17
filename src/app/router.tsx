import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from './AppLayout';
import { PlaceholderPage } from '../pages/PlaceholderPage';

/**
 * Phase 0 wires the shell and one placeholder so the app boots and the route
 * names are settled. Each phase replaces a placeholder with the real screen.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <PlaceholderPage title="Dashboard" phase="1" /> },
      { path: 'designs', element: <PlaceholderPage title="My Designs" phase="2" /> },
      { path: 'create', element: <PlaceholderPage title="Create Product" phase="3a" /> },
      { path: 'create/:slug', element: <PlaceholderPage title="Customize" phase="3b" /> },
      { path: 'cart', element: <PlaceholderPage title="Cart" phase="4" /> },
      { path: 'checkout', element: <PlaceholderPage title="Checkout" phase="4" /> },
      { path: 'orders', element: <PlaceholderPage title="My Orders" phase="5" /> },
      { path: 'admin', element: <PlaceholderPage title="Admin" phase="5" /> },
      { path: '*', element: <PlaceholderPage title="Not found" phase="—" /> },
    ],
  },
]);
