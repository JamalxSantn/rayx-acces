import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, SlidersHorizontal } from 'lucide-react';
import api from '../api.js';
import {
  PageHeader, SearchBar, FilterGroup, EmptyState, Spinner, Leveldot, fmtDate,
} from '../components/ui.jsx';

export default function Security() {
  const [logs, setLogs] = useState(null);
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('all');

  const load = useCallback(async () => {
    const { data } = await api.get('/security/logs', { params: { q, level } });
    setLogs(data.logs);
  }, [q, level]);

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <PageHeader title="Security" subtitle="Full site activity log — every meaningful action is recorded here." />

      <div className="card mb-4 space-y-3 p-4">
        <SearchBar value={q} onChange={setQ} placeholder="Search by user, action, target or detail…" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-600"><SlidersHorizontal size={13} /> Filters</div>
          <FilterGroup label="Level" value={level} onChange={setLevel}
            options={[
              { value: 'all', label: 'All' },
              { value: 'info', label: 'Info' },
              { value: 'success', label: 'Success' },
              { value: 'warning', label: 'Warning' },
              { value: 'danger', label: 'Danger' },
            ]} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {!logs ? (
          <div className="flex justify-center py-16"><Spinner size={22} /></div>
        ) : logs.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="No log entries" hint="Try changing your search or filters." />
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.015, 0.25) }}
                className="flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.02]"
              >
                <Leveldot level={l.level} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-200">
                    <span className="font-medium">{l.action}</span>
                    {l.target && <span className="text-zinc-500"> · <span className="font-mono text-xs">{l.target}</span></span>}
                  </div>
                  {l.detail && <div className="truncate text-xs text-zinc-500">{l.detail}</div>}
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <div className="text-xs font-medium text-zinc-400">{l.actor || 'system'}</div>
                  <div className="text-xs text-zinc-600">{fmtDate(l.created_at)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
