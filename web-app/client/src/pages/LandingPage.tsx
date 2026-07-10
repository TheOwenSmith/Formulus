import logoWide from '@client/assets/logo-wide.svg';
import { FloatingParticles } from '@client/components/FloatingParticles';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TAGLINES = [
  'Systematic trading, without the headache',
  'Algorithm validation in less than a minute',
  'Where alpha is generated',
  'Supports Python, Javascript, TypeScript, and C++',
  '10+ years of historical, cleansed market data',
  'From strategy to Sharpe ratio in <50 lines of code',
];

function RotatingTagline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % TAGLINES.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-6 flex items-center justify-center text-center px-4 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-white/60 text-sm"
        >
          {TAGLINES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-8 font-sans relative">
      <FloatingParticles />

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

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-2xl relative z-10 flex flex-col items-center gap-5"
      >
        <motion.div variants={itemVariants} className="flex flex-col items-center gap-3">
          <h1 className="m-0">
            <img
              src={logoWide}
              alt="Formulus"
              className="h-17 w-auto"
              style={{ filter: 'drop-shadow(0 0 32px rgba(59, 130, 246, 0.35))' }}
            />
          </h1>

          <RotatingTagline />
        </motion.div>

        <motion.div variants={itemVariants} className="relative w-full">
          <motion.div
            className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 blur-md"
            animate={{ opacity: [0.45, 0.8, 0.45] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative bg-slate-900/80 rounded-2xl p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-[10px]">
            <div className="aspect-video w-full overflow-hidden rounded-xl">
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/fCSm11IbmKw"
                title="Formulus demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </motion.div>

        <motion.button
          variants={itemVariants}
          onClick={() => navigate('/login')}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="group px-8 py-3.5 rounded-xl font-semibold text-base cursor-pointer border shadow-[0_10px_40px_rgba(59,130,246,0.35)] bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border-blue-500/30 hover:border-blue-500/50 text-white flex items-center gap-2"
        >
          <span>See it in Action</span>
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
            &rarr;
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
