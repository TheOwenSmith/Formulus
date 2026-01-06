export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center font-sans relative overflow-hidden">
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

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/10 rounded-full" />
          <div className="w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full animate-spin absolute top-0 left-0" />
        </div>
        <h2
          className="text-2xl font-bold bg-clip-text text-transparent"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(34, 211, 238), rgb(59, 130, 246), rgb(168, 85, 247))',
          }}
        >
          Loading...
        </h2>
      </div>
    </div>
  );
}

