import { createBrowserRouter, Navigate, Outlet, redirect } from 'react-router-dom';
import { AuthenticatedLayout, RootLayout } from './layout';
import { getSession } from './lib/auth-client';
import { algorithmEditorLoader } from './loaders/algorithmEditorLoader';
import { algorithmsLoader } from './loaders/algorithmsLoader';
import { backtestLoader } from './loaders/backtestLoader';
import { AboutPage } from './pages/AboutPage';
import { AlgorithmEditorPage } from './pages/AlgorithmEditorPage';
import { AlgorithmsPage } from './pages/AlgorithmsPage';
import { BacktestPage } from './pages/BacktestPage';
import { CreateAlgorithmPage } from './pages/CreateAlgorithmPage';
import { ErrorPage } from './pages/ErrorPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { PhoenixPositionManagementPdfRedirect } from './pages/PhoenixPositionManagementPdfRedirect';
import { ProfilePage } from './pages/ProfilePage';
import { SharedPage } from './pages/SharedPage';
import { SubmissionsPage } from './pages/SubmissionsPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        loader: requireAuthLoader,
        shouldRevalidate: () => false,
        element: <AuthenticatedLayout />,
        children: [
          {
            path: '/algorithms',
            element: <AlgorithmsPage />,
            loader: algorithmsLoader,
          },
          {
            path: '/algorithms/new',
            element: <CreateAlgorithmPage />,
          },
          {
            path: '/algorithms/:id',
            element: <AlgorithmEditorPage />,
            loader: algorithmEditorLoader,
            errorElement: (
              <ErrorPage
                title="Algorithm Not Found"
                message="This algorithm could not be found. It may have been deleted."
                actionText="Go Back"
              />
            ),
          },
          {
            path: '/backtests',
            element: <SubmissionsPage />,
          },
          {
            path: '/shared',
            element: <SharedPage />,
          },
          {
            path: '/backtest/:publicId',
            element: <BacktestPage />,
            loader: backtestLoader,
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
            path: '/docs/Phoenix_Trader_Position_Management_System.pdf',
            element: <PhoenixPositionManagementPdfRedirect />,
          },
          {
            path: '/profile',
            element: <ProfilePage />,
          },
          {
            path: '*',
            element: <Navigate to="/algorithms" replace />,
          },
        ],
      },
      {
        loader: requireGuestLoader,
        children: [
          {
            path: '/',
            element: <LandingPage />,
          },
          {
            path: '/login',
            element: <LoginPage />,
          },
          {
            path: '*',
            element: <Navigate to="/" replace />,
          },
        ],
      },
    ],
  },
]);

async function requireAuthLoader({ request }: { request: Request }) {
  const { data: session } = await getSession();
  if (session == null) {
    const { pathname, search } = new URL(request.url);
    throw redirect(`/login?redirect=${encodeURIComponent(pathname + search)}`);
  }
  return <Outlet />;
}

async function requireGuestLoader() {
  const { data: session } = await getSession();
  if (session != null) throw redirect('/algorithms');
  return <Outlet />;
}
