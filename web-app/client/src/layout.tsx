import { Outlet, useLoaderData, useNavigation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { BacktestPoller } from './components/BacktestPoller';
import { GuestHeader } from './components/GuestHeader';
import { Header } from './components/Header';
import { LoadingScreen } from './components/LoadingScreen';

export function RootLayout() {
  const navigation = useNavigation();
  const loading = navigation.state !== 'idle';

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'toast-custom',
        }}
      />
      {loading ? <LoadingScreen /> : <Outlet />}
    </>
  );
}

export function AuthenticatedLayout() {
  return (
    <>
      <BacktestPoller />
      <Header />
      <Outlet />
    </>
  );
}

// Backtest results are viewable without a session; guests get a login-only header
export function BacktestLayout() {
  const { isLoggedIn } = useLoaderData<{ isLoggedIn: boolean }>();

  if (isLoggedIn) {
    return (
      <>
        <BacktestPoller />
        <Header />
        <Outlet />
      </>
    );
  }

  return (
    <>
      <GuestHeader />
      <Outlet />
    </>
  );
}
