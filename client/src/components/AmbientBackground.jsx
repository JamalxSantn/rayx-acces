import { motion } from 'framer-motion';

// Subtle animated ambience behind the whole control panel. Monochrome, low-alpha
// so content stays perfectly readable. Fixed + non-interactive.
export default function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* deep base wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-ink-950 to-black" />

      {/* drifting orbs */}
      <motion.div
        className="absolute -top-32 left-1/4 h-[32rem] w-[32rem] rounded-full bg-white/[0.05] blur-[120px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, 10, 0], opacity: [0.4, 0.7, 0.5, 0.4] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-20 h-[36rem] w-[36rem] rounded-full bg-white/[0.04] blur-[130px]"
        animate={{ x: [0, -50, 20, 0], y: [0, -30, -10, 0], opacity: [0.35, 0.6, 0.4, 0.35] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-white/[0.03] blur-[90px]"
        animate={{ y: [0, 50, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* static grid, faded toward the edges (does not move) */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(circle at 50% 40%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 40%, black, transparent 80%)',
        }}
      />

      {/* top sheen */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.04] to-transparent" />
    </div>
  );
}
