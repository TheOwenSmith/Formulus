import { Outlet, useNavigation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { BacktestPoller } from './components/BacktestPoller';
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
