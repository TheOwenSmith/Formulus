import logoWide from '@client/assets/logo-wide.svg';
import { Link, NavLink } from 'react-router-dom';

export function Header() {
  return (
    <header className="bg-slate-900/80 backdrop-blur-[10px] border-b border-white/10 sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <nav
        className="max-w-[1400px] mx-auto px-8 flex items-center justify-between"
        style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
      >
        <Link to="/backtest" className="no-underline transition-all duration-300 flex items-center">
          <img src={logoWide} alt="PhoenixTrader" className="h-12 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <NavLink
            to="/backtest"
            className={({ isActive }) =>
              `text-base font-medium px-6 py-3 rounded-lg transition-all duration-300 relative no-underline tracking-[0.01em] border ${
                isActive
                  ? 'text-white border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] bg-gradient-to-br from-blue-500/15 to-emerald-500/15 after:content-[""] after:absolute after:bottom-[-1px] after:left-1/2 after:-translate-x-1/2 after:w-[60%] after:h-0.5 after:bg-gradient-to-r after:from-blue-500 after:to-emerald-500 after:rounded-sm after:shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                  : 'text-white/70 border-transparent hover:text-white hover:bg-slate-800/50 hover:-translate-y-0.5'
              }`
            }
          >
            Backtest
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `text-base font-medium px-6 py-3 rounded-lg transition-all duration-300 relative no-underline tracking-[0.01em] border ${
                isActive
                  ? 'text-white border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] bg-gradient-to-br from-blue-500/15 to-emerald-500/15 after:content-[""] after:absolute after:bottom-[-1px] after:left-1/2 after:-translate-x-1/2 after:w-[60%] after:h-0.5 after:bg-gradient-to-r after:from-blue-500 after:to-emerald-500 after:rounded-sm after:shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                  : 'text-white/70 border-transparent hover:text-white hover:bg-slate-800/50 hover:-translate-y-0.5'
              }`
            }
          >
            About
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `text-base font-medium px-6 py-3 rounded-lg transition-all duration-300 relative no-underline tracking-[0.01em] border ${
                isActive
                  ? 'text-white border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] bg-gradient-to-br from-blue-500/15 to-emerald-500/15 after:content-[""] after:absolute after:bottom-[-1px] after:left-1/2 after:-translate-x-1/2 after:w-[60%] after:h-0.5 after:bg-gradient-to-r after:from-blue-500 after:to-emerald-500 after:rounded-sm after:shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                  : 'text-white/70 border-transparent hover:text-white hover:bg-slate-800/50 hover:-translate-y-0.5'
              }`
            }
          >
            Profile
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
