import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ScrollText, MessagesSquare, Users, KeyRound,
  Image, ShieldAlert, UserCog, LogOut, Menu, Shield, ChevronRight, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import AmbientBackground from './AmbientBackground.jsx';

const NAV = [
  { section: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    section: 'Community',
    items: [
      { to: '/changelogs', label: 'ChangeLogs', icon: ScrollText },
      { to: '/chat', label: 'Staff Chat', icon: MessagesSquare },
    ],
  },
  {
    section: 'Management',
    items: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/license-key', label: 'License Key', icon: KeyRound },
      { to: '/screenshots', label: 'ScreenShots', icon: Image },
    ],
  },
  { section: 'Security', items: [{ to: '/security', label: 'Security', icon: ShieldAlert }] },
  { section: 'Admin', items: [{ to: '/website-users', label: 'Website Users', icon: UserCog }] },
];

const FLAT = NAV.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section })));
const crumbFor = (p) => FLAT.find((i) => i.to === p) || { section: 'Overview', label: 'Dashboard' };

function NavItem({ item, collapsed, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl py-2 text-sm transition-colors duration-200 ${
          collapsed ? 'justify-center px-2' : 'px-2.5'
        } ${
          isActive
            ? 'border border-white/10 bg-gradient-to-r from-white/[0.12] to-white/[0.03] text-white shadow-[0_2px_20px_-6px_rgba(255,255,255,0.25)]'
            : 'border border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
      }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white" />
          )}
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
              isActive ? 'bg-white text-black shadow-sm' : 'bg-white/[0.04] text-zinc-400 group-hover:text-zinc-100'
            }`}
          >
            <item.icon size={15} strokeWidth={2.2} />
          </span>
          {!collapsed && <span className="font-medium">{item.label}</span>}
          {!collapsed && isActive && <ChevronRight size={14} className="ml-auto text-white/60" />}
        </>
      )}
    </NavLink>
  );
}

// Endlessly types out the brand, pauses, erases it, and types it again.
function Typewriter({ text }) {
  const [display, setDisplay] = useState(text);
  const [phase, setPhase] = useState('pausing');

  useEffect(() => {
    let t;
    if (phase === 'typing') {
      if (display.length < text.length) t = setTimeout(() => setDisplay(text.slice(0, display.length + 1)), 120);
      else t = setTimeout(() => setPhase('pausing'), 2200);
    } else if (phase === 'pausing') {
      t = setTimeout(() => setPhase('deleting'), 2200);
    } else {
      if (display.length > 0) t = setTimeout(() => setDisplay(text.slice(0, display.length - 1)), 75);
      else t = setTimeout(() => setPhase('typing'), 450);
    }
    return () => clearTimeout(t);
  }, [display, phase, text]);

  return (
    <span className="inline-flex items-center">
      {display}
      <motion.span
        aria-hidden
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[1px] bg-zinc-500"
      />
    </span>
  );
}

function SidebarContent({ collapsed, onToggle, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-ink-900/80 via-ink-950/70 to-ink-950/90">
      {/* Brand + collapse toggle */}
      <div className={`flex items-center py-5 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-white/30 blur-md" />
            <img src="/logo.png" alt="Rayx Acces" className="relative h-9 w-9 rounded-xl object-cover ring-1 ring-white/20" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-tight text-white">
                <Typewriter text="Rayx Acces" />
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">Control Panel</div>
            </div>
          )}
        </div>
        {!collapsed && onToggle && (
          <button onClick={onToggle} title="Collapse sidebar" className="hidden rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white lg:block">
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {collapsed && onToggle && (
        <button onClick={onToggle} title="Expand sidebar" className="mx-auto mb-2 hidden rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white lg:block">
          <PanelLeft size={18} />
        </button>
      )}

      <div className="mx-4 mb-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        {NAV.map((group) => (
          <div key={group.section} className="mb-4">
            {!collapsed ? (
              <div className="mb-1.5 flex items-center gap-2 px-2.5">
                <span className="h-px w-3 bg-white/15" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">{group.section}</span>
              </div>
            ) : (
              <div className="mx-auto mb-1.5 h-px w-6 bg-white/10" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Status pill */}
      {!collapsed && (
        <div className="px-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs text-zinc-400">All systems operational</span>
          </div>
        </div>
      )}

      {/* User */}
      <div className="p-3">
        <div className={`flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] py-2 ${collapsed ? 'justify-center px-2' : 'px-2.5'}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white to-zinc-400 text-sm font-bold text-black">
            {(user?.username || '?').slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{user?.username}</div>
                <div className="text-[11px] font-medium text-zinc-500">Staff</div>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                title="Sign out"
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ryzex_sidebar') === 'collapsed');
  const location = useLocation();
  const crumb = crumbFor(location.pathname);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('ryzex_sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  };

  return (
    <div className="relative flex h-screen overflow-hidden">
      <AmbientBackground />

      {/* Desktop sidebar (width-animated, no janky layout animations inside) */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 84 : 256 }}
        transition={{ type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative hidden shrink-0 border-r border-white/10 backdrop-blur-2xl lg:block"
      >
        <SidebarContent collapsed={collapsed} onToggle={toggle} />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      </motion.aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-ink-950 lg:hidden"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-white/10 bg-ink-950/40 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-zinc-300 hover:bg-white/10 lg:hidden">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-zinc-500 sm:inline">{crumb.section}</span>
            <ChevronRight size={14} className="hidden text-zinc-700 sm:inline" />
            <span className="font-medium text-white">{crumb.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live
            </div>
            <div className="hidden text-xs text-zinc-500 md:block">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-7xl px-5 py-7 sm:px-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
