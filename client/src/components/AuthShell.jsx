import { motion } from 'framer-motion';
import { Shield, KeyRound, Users, ShieldCheck } from 'lucide-react';

export default function AuthShell({ children }) {
  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden border-r border-white/10 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-950 to-black" />
        {/* animated orbs */}
        <motion.div
          className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl"
          animate={{ y: [0, 30, 0], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/[0.04] blur-3xl"
          animate={{ y: [0, -40, 0] }}
          transition={{ duration: 11, repeat: Infinity }}
        />
        {/* grid lines */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(circle at 40% 40%, black, transparent 75%)',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <img src="/logo.png" alt="Rayx Acces" className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/20" />
            <span className="text-xl font-bold tracking-tight text-white">
              Rayx Acces<span className="text-zinc-500"> Auth</span>
            </span>
          </motion.div>

          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-white"
            >
              Secure access &<br />license control, refined.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400"
            >
              Two-factor protected staff panel for managing users, license keys, moderation and
              security — all in one place.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-8 flex flex-wrap gap-2"
            >
              {[
                [ShieldCheck, '2FA enforced'],
                [KeyRound, 'License keys'],
                [Users, 'Discord-linked'],
              ].map(([Icon, label]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-zinc-300"
                >
                  <Icon size={14} /> {label}
                </div>
              ))}
            </motion.div>
          </div>

          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} Rayx Acces. All rights reserved.</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
