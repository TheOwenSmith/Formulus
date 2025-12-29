function ExternalLink({
  href,
  children,
  className = 'text-cyan-400 hover:text-cyan-300 underline transition-colors',
}: {
  href: string;
  children: string | React.ReactElement;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 pt-4 pb-8 font-sans text-white">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-8 animate-[fadeInDown_0.8s_ease-out]">
          <h1
            className="text-4xl font-bold m-0 bg-clip-text text-transparent tracking-tight leading-normal pb-1"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgb(34, 211, 238), rgb(59, 130, 246), rgb(168, 85, 247))',
            }}
          >
            About
          </h1>
        </div>

        <div className="space-y-6 animate-[fadeInUp_0.8s_ease-out_0.2s_both]">
          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <p className="text-white/90 leading-relaxed mb-6">
              I,{' '}
              <ExternalLink href="https://linkedin.com/in/owensmith2006">Owen Smith</ExternalLink>,
              built Formulus to solve a problem I kept running into: existing trading frameworks
              either required writing thousands of lines of infrastructure code or were too
              abstracted to handle real-world constraints like transaction costs and position
              management. I wanted a system where I could focus on algorithm development and
              mathematical formulation, not data pipelines and execution logic.
            </p>
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Technical Summary
            </h2>
            <p className="text-white/90 leading-relaxed mb-4">
              The system is a TypeScript framework (10,000+ lines) with three main components:
            </p>
            <ul className="text-white/90 leading-relaxed mb-4 space-y-2 list-disc list-inside ml-4">
              <li>
                <strong className="text-white">Backtesting engine:</strong> Simulates how strategies
                would have performed with transaction costs and realistic market conditions
              </li>
              <li>
                <strong className="text-white">Data API:</strong> Fetches and cleans stock price
                data (tick-level and minute-level) and handles data quality issues
              </li>
              <li>
                <strong className="text-white">Algorithm layer:</strong> Algorithmic creation that
                perfectly blends simplicity and capability.
              </li>
              <li>
                <strong className="text-white">SaaS platform:</strong> Expanded into{' '}
                <ExternalLink href="https://formulus.ai">formulus.ai</ExternalLink>, which lets
                others develop algorithms without building everything from scratch
              </li>
            </ul>
          </div>

          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              System Architecture
            </h2>
            <div className="space-y-4">
              <div>
                <strong className="text-white">Data Pipeline:</strong>
                <p className="text-white/90 leading-relaxed mt-1">
                  Fetches stock price data from multiple sources at tick-level and minute-level
                  granularity. Handles common data problems like missing data points, stock splits,
                  and different data formats from different exchanges. Stores the data in a way that
                  makes it fast to query historical prices for backtesting.
                </p>
              </div>
              <div>
                <strong className="text-white">Backtesting Engine:</strong>
                <p className="text-white/90 leading-relaxed mt-1">
                  Simulates how a strategy would have performed by replaying historical market data.
                  Accounts for transaction costs (slippage) and assumes realistic delays when
                  placing orders. Can test strategies on different time periods to make sure they're
                  not just overfitting to one dataset.
                </p>
              </div>
              <div>
                <strong className="text-white">Algorithm Layer:</strong>
                <p className="text-white/90 leading-relaxed mt-1">
                  TypeScript code that lets you write trading strategies. Handles the mechanics of
                  position sizing, risk limits, and rebalancing so you can focus on the strategy
                  logic. Separates the "what to trade" decision from the "how to execute it"
                  details, with automated tests to make sure portfolio calculations are correct.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Position Management System
            </h2>
            <p className="text-white/90 leading-relaxed mb-4">
              Simple rebalancing—evenly dividing position sizes across different tickers—breaks down
              when transaction costs matter. Each ticker has different slippage characteristics that
              must be estimated using microstructure noise estimation. Because selling yields less
              cash than a position's value and buying costs more than the target amount, the
              rebalancing problem becomes nonlinear.
            </p>
            <p className="text-white/90 leading-relaxed mb-4">
              The{' '}
              <ExternalLink href="/api/docs/Phoenix_Trader_Position_Management_System.pdf">
                Phoenix Trader Position Management System
              </ExternalLink>{' '}
              solves this by finding how much to put in each stock while accounting for transaction
              costs and maintaining the target investment percentage. The solution involves sorting
              your current positions, checking different ranges of position sizes, and solving a
              linear equation to find the right amount.
            </p>
            <p className="text-white/90 leading-relaxed">
              This work required both mathematical formulation (deriving the closed-form solution)
              and careful implementation (handling floating-point precision, interval boundaries,
              and unit conventions for slippage rates). It demonstrated the intersection of
              mathematical rigor and software engineering in quantitative finance.
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              A&O Quantitative
            </h2>
            <p className="text-white/90 leading-relaxed mb-4">
              This system is currently{' '}
              <ExternalLink href="https://linkedin.com/company/aoquantitative">
                A&O Quantitative
              </ExternalLink>
              's biggest project.{' '}
              <ExternalLink href="https://linkedin.com/company/aoquantitative">
                A&O Quantitative
              </ExternalLink>{' '}
              is a student-run trading group I co-founded with three other University of Chicago
              students. We deploy multilateral strategies across our different trading pods. I
              manage the algorithmic trading pod, where Formulus is the sole project and actively
              manages $25K AUM.
            </p>
            <p className="text-white/90 leading-relaxed">
              Each pod has separate risk budgets and position limits. The algorithmic pod uses this
              framework for strategy development, backtesting, and live execution. The group has
              grown to $35K AUM across all pods.
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Connect
            </h2>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://linkedin.com/in/owensmith2006"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-white hover:from-cyan-500/30 hover:to-blue-500/30 transition-all duration-300 hover:scale-105 flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                <span>Personal LinkedIn</span>
              </a>
              <a
                href="https://linkedin.com/company/aoquantitative"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-white hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 hover:scale-105 flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                <span>A&O Quantitative LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
