import logoWide from '@client/assets/logo-wide.svg';
import { useUserStore } from '@client/stores/user-store';
import { Link, useLocation } from 'react-router-dom';

// Header for logged-out visitors viewing a public backtest result
export function GuestHeader() {
  const { hasAccount } = useUserStore();
  const { pathname, search } = useLocation();
  const loginUrl = `/login?redirect=${encodeURIComponent(pathname + search)}`;

  return (
    <header className="bg-slate-900/80 backdrop-blur-[10px] border-b border-white/10 sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <nav
        className="max-w-[1400px] mx-auto px-8 flex items-center justify-between"
        style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
      >
        <Link to={loginUrl} className="no-underline transition-all duration-300 flex items-center">
          <img src={logoWide} alt="PhoenixTrader" className="h-12 w-auto" />
        </Link>
        <Link
          to={loginUrl}
          className="no-underline rounded-xl px-6 py-3 text-base font-medium text-white border border-blue-500/40 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 hover:-translate-y-0.5"
        >
          {hasAccount ? 'Log In' : 'Sign Up'}
        </Link>
      </nav>
    </header>
  );
}
