import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  KeySquare, Users, CheckCircle2, Clock, ShieldBan, UserCog, TrendingUp, Activity,
} from 'lucide-react';
import api from '../api.js';
import { PageHeader, Spinner, StatusBadge, Leveldot, timeAgo, fmtDate, Avatar } from '../components/ui.jsx';

const CARD = [
  { key: 'keys', label: 'Memberships', icon: KeySquare },
  { key: 'users', label: 'Discord Users', icon: Users },
  { key: 'active', label: 'Active', icon: CheckCircle2, tone: 'text-emerald-400' },
  { key: 'expired', label: 'Expired', icon: Clock, tone: 'text-amber-400' },
  { key: 'banned', label: 'Banned', icon: ShieldBan, tone: 'text-red-400' },
  { key: 'websiteUsers', label: 'Website Users', icon: UserCog },
];

function StatCard({ card, value, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card group relative overflow-hidden p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">{card.label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white tabular-nums">{value ?? 0}</div>
        </div>
        <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-2.5 ${card.tone || 'text-zinc-300'}`}>
          <card.icon size={18} />
        </div>
      </div>
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/[0.03] blur-2xl transition group-hover:bg-white/[0.06]" />
    </motion.div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/stats').then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data)
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        <Spinner size={22} />
      </div>
    );

  const maxPlan = Math.max(1, ...data.planBreakdown.map((p) => p.count));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="A live overview of your licensing operation." />

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {CARD.map((c, i) => (
          <StatCard key={c.key} card={c} value={data.totals[c.key]} index={i} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* timeline chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 font-medium text-white"><TrendingUp size={16} /> Keys created</div>
              <div className="text-xs text-zinc-500">Last 14 days</div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeline} margin={{ left: -22, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#101013', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 12 }}
                  cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <Area type="monotone" dataKey="count" stroke="#fff" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* plan breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5">
          <div className="mb-4 font-medium text-white">Plan breakdown</div>
          <div className="space-y-4">
            {data.planBreakdown.map((p) => (
              <div key={p.plan}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-zinc-300">{p.label}</span>
                  <span className="font-medium text-white tabular-nums">{p.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.count / maxPlan) * 100}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-zinc-400 to-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* recent keys */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-5">
          <div className="mb-3 font-medium text-white">Recent members</div>
          <div className="space-y-1">
            {data.recentKeys.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No members yet.</p>}
            {data.recentKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
                <Avatar src={k.discord_avatar} name={k.discord_username} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-200">{k.discord_username || k.discord_id}</div>
                  <div className="truncate font-mono text-xs text-zinc-500">{k.uuid || k.discord_id}</div>
                </div>
                <StatusBadge status={k.status} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* recent activity */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-5">
          <div className="mb-3 flex items-center gap-2 font-medium text-white"><Activity size={16} /> Recent activity</div>
          <div className="space-y-1">
            {data.recentLogs.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No activity yet.</p>}
            {data.recentLogs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
                <Leveldot level={l.level} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-200">
                    <span className="font-medium">{l.action}</span>
                    {l.target && <span className="text-zinc-500"> · {l.target}</span>}
                  </div>
                  <div className="text-xs text-zinc-600">{l.actor} · {timeAgo(l.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
