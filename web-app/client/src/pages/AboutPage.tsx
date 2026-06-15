import { LINKEDIN } from '@client/icons/index';

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
            <p className="text-white/90 leading-relaxed mb-4">
              A couple of months ago, I started to explore algorithmic trading. While there were
              many ideas I had for strategies to explore and possibly paper trade, I recurrently ran
              into the same issues. Finding quality tick data is expensive and non-trivial to
              compile, &ldquo;vibe-coded&rdquo; backtests cannot be trusted, and even simple
              strategies take hundreds of lines of code. Knowing there are thousands, perhaps tens
              of thousands, of developers / traders dealing with the same issues, I created{' '}
              <ExternalLink href="https://formulus.ai">formulus.ai</ExternalLink>.
            </p>
            <p className="text-white/90 leading-relaxed">
              With Formulus, these struggles no longer need to be dealt with. I sourced and cleansed
              data from multiple trading APIs, created a high-level trading framework that supports
              four programming languages, and built a robust backtesting engine so you don&apos;t
              have to. With this robust system, the most complicated strategies can be created and
              tested in minutes with fewer than 100 lines of code, allowing you to focus on ideas
              rather than debugging syntax errors. For users that need low-level, granular control,
              Formulus may not be for them; however, it excels at efficient experimentation and idea
              validation.
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              System Architecture
            </h2>
            <p className="text-white/90 leading-relaxed">
              <ExternalLink href="https://formulus.ai">formulus.ai</ExternalLink> is a SaaS
              application that consists of a frontend, a backend, and a backtesting worker. At a
              high level, when a user has a strategy they wish to backtest, the user submits a
              request to the API, which adds the submission to a queue in AWS. The queue submission
              triggers a lambda dispatcher, which then starts a worker task. The worker fetches the
              appropriate submission from the database and then downloads the relevant tick data
              files and indices from S3. Since the user&apos;s code is possibly malicious, the
              worker initiates a Docker container and uploads the user&apos;s code to said container
              via a bind mount. Note that since the worker is an ECS task, this process creates an
              interesting docker-in-docker design. After the backtest is completed or when the user
              code errors, the container containing the user&apos;s code is killed, and the
              backtesting results or errors, resp., are uploaded in the database, and the ECS task
              is terminated. Finally, on the frontend, users can view their results using the
              performance analysis dashboard.{' '}
              <ExternalLink href="#">Learn more</ExternalLink>
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Position Management System
            </h2>
            <p className="text-white/90 leading-relaxed">
              Position management is frequently an annoyance and often one of the most tedious,
              time-consuming aspects of systematic trading. When simply trying to verify a strategy,
              researchers may want to prioritize optimizing entries and exits without dealing with
              capital allocation. What would a system look like that allows traders to ignore
              position sizing all together? The{' '}
              <ExternalLink href="/docs/Phoenix_Trader_Position_Management_System.pdf">
                Phoenix Trader Position Management System
              </ExternalLink>
              . This system allows for quick iteration without neglect for position sizing and is
              what governs every trade made through Formulus.
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px]">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              A&amp;O Quantitative
            </h2>
            <p className="text-white/90 leading-relaxed mb-4">
              This system is currently{' '}
              <ExternalLink href="https://linkedin.com/company/aoquantitative">
                A&O Quantitative
              </ExternalLink>
              &apos;s biggest project.{' '}
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
                  <path d={LINKEDIN} />
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
                  <path d={LINKEDIN} />
                </svg>
                <span>A&amp;O Quantitative LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
