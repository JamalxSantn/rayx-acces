import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, CheckCircle2, AlertTriangle, Info, XCircle, Loader2 } from 'lucide-react';

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((x) => [...x, { id, ...t }]);
    setTimeout(() => setToasts((x) => x.filter((i) => i.id !== id)), t.duration || 3800);
  }, []);
  const toast = {
    success: (m) => push({ type: 'success', message: m }),
    error: (m) => push({ type: 'error', message: m }),
    info: (m) => push({ type: 'info', message: m }),
  };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info;
            const color =
              t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-sky-400';
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="card flex items-center gap-3 px-4 py-3 pr-5 min-w-[260px] max-w-sm"
              >
                <Icon size={18} className={color} />
                <span className="text-sm text-zinc-200">{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- Badges ---------------- */
export function StatusBadge({ status }) {
  const map = {
    active: ['border-emerald-500/30 bg-emerald-500/10 text-emerald-300', 'Active'],
    expired: ['border-amber-500/30 bg-amber-500/10 text-amber-300', 'Expired'],
    banned: ['border-red-500/30 bg-red-500/10 text-red-300', 'Banned'],
    frozen: ['border-sky-500/30 bg-sky-500/10 text-sky-300', 'Frozen'],
  };
  const [cls, label] = map[status] || ['border-white/10 bg-white/5 text-zinc-300', status];
  return (
    <span className={`badge ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-zinc-300',
    mono: 'border-white/15 bg-white/10 text-white',
    feature: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    fix: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    update: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
    announcement: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  };
  return <span className={`badge ${tones[tone] || tones.default}`}>{children}</span>;
}

/* ---------------- Avatar ---------------- */
export function Avatar({ src, name, size = 40 }) {
  const [err, setErr] = useState(false);
  const initials = (name || '?').slice(0, 2).toUpperCase();
  if (!src || err)
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-ink-700 to-ink-850 text-xs font-semibold text-zinc-300"
      >
        {initials}
      </div>
    );
  return (
    <img
      src={src}
      onError={() => setErr(true)}
      style={{ width: size, height: size }}
      className="rounded-full border border-white/10 object-cover bg-ink-800"
      alt={name}
    />
  );
}

/* ---------------- Loaders ---------------- */
export function Spinner({ size = 18, className = '' }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function TableSkeleton({ rows = 6, cols = 4 }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-9 flex-1" style={{ opacity: 1 - i * 0.08 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <Icon className="text-zinc-500" size={24} />
        </div>
      )}
      <div>
        <p className="font-medium text-zinc-300">{title}</p>
        {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
      </div>
    </div>
  );
}

/* ---------------- Search bar ---------------- */
export function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative flex-1 min-w-[180px]">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input
        className="input pl-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

/* ---------------- Filter pills ---------------- */
export function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && <span className="mr-1 text-xs uppercase tracking-wider text-zinc-500">{label}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`chip ${value === o.value ? 'chip-active' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={`card relative z-10 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Page header ---------------- */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ---------------- misc ---------------- */
export function timeAgo(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'));
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'));
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Leveldot({ level }) {
  const c =
    level === 'success' ? 'bg-emerald-400' : level === 'warning' ? 'bg-amber-400' : level === 'danger' ? 'bg-red-400' : 'bg-sky-400';
  return <span className={`h-2 w-2 shrink-0 rounded-full ${c}`} />;
}
