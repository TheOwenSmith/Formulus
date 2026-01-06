import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { LoadingScreen } from './components/LoadingScreen';
import { useSession } from './lib/auth-client';
import { trpcCredentials } from './lib/trpc';
import { AboutPage } from './pages/AboutPage';
import { BacktestPage } from './pages/BacktestPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';

export function App() {
  const { data: session, isPending } = useSession();

  const { data: sampleData, isPending: sampleDataIsPending } = useQuery(
    trpcCredentials.backtesting['get-backtesting-results'].queryOptions({
      publicId: '12345678',
    }),
  );

  if (sampleDataIsPending) {
    return <LoadingScreen />;
  }

  if (sampleData == null) {
    return <div>No data found</div>;
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'toast-custom',
        }}
      />
      {isPending ? (
        <LoadingScreen />
      ) : session ? (
        // If authenticated
        <>
          <Header />
          <Routes>
            <Route path="/backtest" element={<BacktestPage data={sampleData} />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/about" replace />} />
          </Routes>
        </>
      ) : (
        // If not authenticated
        <>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </>
      )}
    </>
  );
}
