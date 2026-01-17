import { ARROW_LEFT, SVG_NAMESPACE } from '@client/icons/index';
import { ERROR } from '@client/icons/status';
import { isRouteErrorResponse, Link, useNavigate, useRouteError } from 'react-router-dom';

interface ErrorPageProps {
  /**
   * Custom title for the error page. Defaults to "Page Not Found"
   */
  title?: string;
  /**
   * Custom message for the error page. Defaults to a generic not found message
   */
  message?: string;
  /**
   * Custom action button text. Defaults to "Go Back"
   */
  actionText?: string;
  /**
   * Whether to show the error icon. Defaults to true
   */
  showIcon?: boolean;
}

/**
 * Generalized error page component with modern, sleek design.
 * Can be used as a React Router errorElement or as a standalone component.
 * When used as errorElement, it will automatically extract error information from React Router.
 * When used standalone, pass title and message props to avoid hook errors.
 */
export function ErrorPage({ title, message, actionText, showIcon = true }: ErrorPageProps = {}) {
  const navigate = useNavigate();

  // Get error from React Router if available (only works when used as errorElement)
  // Note: This hook will throw if not used within an error boundary.
  // When used standalone, always provide title and message props.
  let routeError: unknown = null;
  // Only try to get route error if we don't have explicit props
  // This prevents the hook from being called unnecessarily when props are provided
  if (!title && !message) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    routeError = useRouteError();
  }

  const error =
    routeError instanceof Error
      ? routeError
      : isRouteErrorResponse(routeError)
        ? new Error(routeError.statusText || `Error ${routeError.status}`)
        : null;

  // Use provided props or fall back to defaults/error message
  // Explicit props take precedence over route error
  const displayTitle = title ?? error?.message ?? 'Page Not Found';
  const displayMessage =
    message ??
    (error
      ? 'The requested resource could not be found or an error occurred.'
      : 'The page you are looking for does not exist or has been moved.');
  const displayActionText = actionText ?? 'Go Back';

  return (
    <div className="h-[calc(100vh-5rem)] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-8 font-sans text-white relative overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 right-1/3 w-72 h-72 bg-rose-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="w-full max-w-2xl animate-[fadeInUp_0.8s_ease-out] relative z-10">
        <div className="bg-slate-900/60 rounded-2xl p-12 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] text-center">
          {showIcon && (
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns={SVG_NAMESPACE}
                    className="text-red-400"
                  >
                    <path
                      d={ERROR}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
              </div>
            </div>
          )}

          <h1
            className="text-5xl font-bold m-0 bg-clip-text text-transparent tracking-tight leading-normal mb-4"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgb(248, 113, 113), rgb(251, 146, 60), rgb(251, 113, 133))',
            }}
          >
            {displayTitle}
          </h1>

          <p className="text-white/70 text-lg mb-8 leading-relaxed max-w-md mx-auto">
            {displayMessage}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-xl font-medium text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 shadow-lg border hover:-translate-y-0.5 bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 border-red-500/30 hover:border-red-500/50 text-white no-underline"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns={SVG_NAMESPACE}
                className="rotate-180"
              >
                <path
                  d={ARROW_LEFT}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{displayActionText}</span>
            </button>

            <Link
              to="/about"
              className="px-6 py-3 rounded-xl font-medium text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 shadow-lg border hover:-translate-y-0.5 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-white no-underline"
            >
              <span>Go to Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
