import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { UserCog, ShieldCheck } from 'lucide-react';
import api from '../api.js';
import { PageHeader, SearchBar, EmptyState, Spinner, Modal, fmtDate } from '../components/ui.jsx';

export default function WebsiteUsers() {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/website-users', { params: { q } });
    setUsers(data.users);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <PageHeader title="Website Users" subtitle="Admin accounts with access to this panel." />

      <div className="card mb-4 p-4">
        <SearchBar value={q} onChange={setQ} placeholder="Search username…" />
      </div>

      {!users ? (
        <div className="flex justify-center py-16"><Spinner size={22} /></div>
      ) : users.length === 0 ? (
        <div className="card"><EmptyState icon={UserCog} title="No admins found" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u, i) => (
            <motion.button
              key={u.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              onClick={() => setSelected(u)}
              className="card flex items-center gap-3 p-4 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-500 text-base font-bold text-black">
                {u.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-white">{u.username}</div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">{u.role}</div>
              </div>
              {u.totp_enabled && <ShieldCheck size={16} className="text-emerald-400" title="2FA enabled" />}
            </motion.button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Website user">
        {selected && (
          <div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-500 text-xl font-bold text-black">
                {selected.username.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="text-lg font-semibold text-white">{selected.username}</div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">{selected.role}</div>
              </div>
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex items-center justify-between border-t border-white/5 pt-2">
                <dt className="text-zinc-500">2FA</dt>
                <dd className={selected.totp_enabled ? 'text-emerald-400' : 'text-amber-400'}>{selected.totp_enabled ? 'Enabled' : 'Not enabled'}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-2">
                <dt className="text-zinc-500">Joined</dt>
                <dd className="text-zinc-200">{fmtDate(selected.created_at)}</dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}
