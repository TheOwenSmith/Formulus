import { createBrowserRouter, Navigate, Outlet, redirect } from 'react-router-dom';
import { AuthenticatedLayout, RootLayout } from './layout';
import { getSession } from './lib/auth-client';
import { trpcCredentialsClient } from './lib/trpc';
import { AboutPage } from './pages/AboutPage';
import { BacktestPage } from './pages/BacktestPage';
import { ErrorPage } from './pages/ErrorPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        loader: requireAuthLoader,
        element: <AuthenticatedLayout />,
        children: [
          {
            path: '/backtest/:publicId',
            element: <BacktestPage />,
            loader: async ({ params }) => {
              const data = await trpcCredentialsClient.backtesting.getBacktestingResults.query({
                publicId: params['publicId'] ?? '',
              });
              if (data == null) {
                throw new Error('Backtesting results not found');
              }
              return { data };
            },
            errorElement: (
              <ErrorPage
                title="Backtesting Results Not Found"
                message="The backtesting results you are looking for could not be found. They may have been deleted or the link may be incorrect."
                actionText="Go Back"
              />
            ),
          },
          {
            path: '/about',
            element: <AboutPage />,
          },
          {
            path: '/profile',
            element: <ProfilePage />,
          },
          {
            path: '*',
            element: <Navigate to="/about" replace />,
          },
        ],
      },
      {
        loader: requireGuestLoader,
        children: [
          {
            path: '/login',
            element: <LoginPage />,
          },
          {
            path: '*',
            element: <Navigate to="/login" replace />,
          },
        ],
      },
    ],
  },
]);

async function requireAuthLoader() {
  const { data: session } = await getSession();

  if (!session) {
    throw redirect('/login');
  }
  return <Outlet />;
}

async function requireGuestLoader() {
  const { data: session } = await getSession();

  if (session) {
    throw redirect('/about');
  }
  return <Outlet />;
}
