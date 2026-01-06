import { GOOGLE_ICON_PATHS, SPINNER_CIRCLE, SPINNER_PATH } from '@client/icons/index';
import { signIn, signUp } from '@client/lib/auth-client';
import { useUserStore } from '@client/stores/user-store';
import '@client/styles/LoginPage.css';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Floating particles component for background
function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
    }> = [];

    // Create particles
    const particleCount = 50;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        opacity: Math.random() * 0.5 + 0.2,
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${particle.opacity})`;
        ctx.fill();
      });

      // Draw connections between nearby particles
      particles.forEach((particle, i) => {
        particles.slice(i + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.1 * (1 - distance / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />
  );
}

export function LoginPage() {
  const { hasAccount, setHasAccount } = useUserStore();
  const [isSignUp, setIsSignUp] = useState(!hasAccount);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [hasError, setHasError] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      await signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/about`,
      });
      // Mark that user has an account and is authenticated after successful Google sign-in
      setHasAccount(true);
    } catch (err) {
      console.error('Error signing in with Google:', err);
      toast.error('Failed to sign in with Google. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Custom validation
    if (isSignUp && !name.trim()) {
      toast.error('Please enter your name');
      setHasError(true);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }

    if (!email.trim()) {
      toast.error('Please enter your email');
      setHasError(true);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }

    if (!email.includes('@')) {
      toast.error('Please enter a valid email address');
      setHasError(true);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }

    if (!password.trim()) {
      toast.error('Please enter your password');
      setHasError(true);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }

    try {
      setIsLoading(true);

      let result;
      if (isSignUp) {
        result = await signUp.email({
          email,
          password,
          name,
        });
      } else {
        result = await signIn.email({
          email,
          password,
        });
      }

      if (result.error) {
        toast.error(
          result.error.message ??
            (isSignUp ? 'Failed to create account' : 'Invalid email or password'),
        );
        setHasError(true);
        setShouldShake(true);
        setIsLoading(false);
        // Reset shake animation after it completes
        setTimeout(() => setShouldShake(false), 500);
        return;
      }

      // Clear any error state on success
      setHasError(false);

      // Mark that user has an account and is authenticated after successful auth
      setHasAccount(true);

      // Redirect on success
      navigate('/backtest');
    } catch (err) {
      console.error(`Error ${isSignUp ? 'signing up' : 'signing in'}:`, err);
      toast.error('An unexpected error occurred. Please try again.');
      setHasError(true);
      setShouldShake(true);
      setIsLoading(false);
      // Reset shake animation after it completes
      setTimeout(() => setShouldShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-8 font-sans relative overflow-hidden">
      {/* Animated background particles */}
      <FloatingParticles />

      {/* Animated gradient orbs */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 right-1/3 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="w-full max-w-md animate-[fadeInUp_0.8s_ease-out] relative z-10">
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-bold m-0 bg-clip-text text-transparent tracking-tight leading-normal pb-2"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgb(34, 211, 238), rgb(59, 130, 246), rgb(168, 85, 247))',
            }}
          >
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-white/70 mt-4 text-lg">
            {isSignUp ? 'Sign up to get started with Formulus' : 'Sign in to continue to Formulus'}
          </p>
        </div>

        <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-5 mb-6" noValidate>
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white/90 mb-2">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setHasError(false);
                  }}
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all duration-300 ${
                    hasError
                      ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500'
                      : 'border-white/10 focus:ring-blue-500/50 focus:border-blue-500/50'
                  } ${shouldShake ? 'animate-shake' : ''}`}
                  placeholder="Your name"
                  disabled={isLoading || isGoogleLoading}
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setHasError(false);
                }}
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all duration-300 ${
                  hasError
                    ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500'
                    : 'border-white/10 focus:ring-blue-500/50 focus:border-blue-500/50'
                } ${shouldShake ? 'animate-shake' : ''}`}
                placeholder="you@example.com"
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setHasError(false);
                }}
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all duration-300 ${
                  hasError
                    ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500'
                    : 'border-white/10 focus:ring-blue-500/50 focus:border-blue-500/50'
                } ${shouldShake ? 'animate-shake' : ''}`}
                placeholder="Password"
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full px-6 py-4 rounded-xl font-medium text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 shadow-lg border hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border-blue-500/30 hover:border-blue-500/50 text-white"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx={SPINNER_CIRCLE.cx}
                      cy={SPINNER_CIRCLE.cy}
                      r={SPINNER_CIRCLE.r}
                      stroke={SPINNER_CIRCLE.stroke}
                      strokeWidth={SPINNER_CIRCLE.strokeWidth}
                    />
                    <path className="opacity-75" fill="currentColor" d={SPINNER_PATH} />
                  </svg>
                  <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                </>
              ) : (
                <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6 flex items-center">
            <div className="flex-1 border-t border-white/10" />
            <span className="px-4 py-1 mx-2 text-sm bg-slate-900/60 backdrop-blur-[10px] text-white/50 rounded-full">
              or
            </span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full px-6 py-4 rounded-xl font-medium text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 shadow-lg border hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-white"
          >
            {isGoogleLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx={SPINNER_CIRCLE.cx}
                    cy={SPINNER_CIRCLE.cy}
                    r={SPINNER_CIRCLE.r}
                    stroke={SPINNER_CIRCLE.stroke}
                    strokeWidth={SPINNER_CIRCLE.strokeWidth}
                  />
                  <path className="opacity-75" fill="currentColor" d={SPINNER_PATH} />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {GOOGLE_ICON_PATHS.map((path, index) => (
                    <path key={index} d={path.d} fill={path.fill} />
                  ))}
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Additional info */}
        <p className="text-center text-white/50 text-sm mt-6">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setName('');
                }}
                className="text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                }}
                className="text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                Sign up
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
