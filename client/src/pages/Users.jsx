import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users as UsersIcon, SlidersHorizontal, Fingerprint, ShieldBan, ShieldCheck,
  Snowflake, Play, Clock, Save, Ban, Plus, Minus, Trash2, Hourglass, RotateCcw,
} from 'lucide-react';
import api, { apiError } from '../api.js';
import {
  PageHeader, SearchBar, FilterGroup, Avatar, StatusBadge, Modal, EmptyState,
  TableSkeleton, Spinner, useToast, fmtDate,
} from '../components/ui.jsx';

/* ---------- one membership row inside the user modal, with actions ---------- */
function MembershipCard({ k, onUpdated, onDeleted }) {
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('');
  const [uuid, setUuid] = useState(k.uuid || '');
  const [confirmDel, setConfirmDel] = useState(false);
  const toast = useToast();

  const run = async (action, url, body) => {
    setBusy(action);
    try {
      const { data } = await api.post(url, body);
      onUpdated(data.key);
      toast.success('Updated');
      if (action === 'ban') setReason('');
      if (action === 'add' || action === 'remove') setDays('');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy('');
    }
  };

  const resetHwid = async () => {
    setBusy('hwid-reset');
    try {
      await api.post(`/hwid/reset/${k.id}`);
      toast.success('HWID reset successfully');
      const updatedKey = { ...k, uuid: null };
      onUpdated(updatedKey);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy('');
    }
  };

  const del = async () => {
    setBusy('delete');
    try {
      await api.delete(`/keys/${k.id}`);
      toast.success('Membership deleted');
      onDeleted(k.id);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy('');
    }
  };

  const dayCount = Math.abs(parseInt(days, 10)) || 0;
  const isLifetime = k.plan === 'lifetime';

  return (
    <div className="rounded-xl border border-white/10 bg-ink-800/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Fingerprint size={14} className="shrink-0 text-zinc-500" />
          <code className="truncate font-mono text-xs text-zinc-200">{k.uuid || '—'}</code>
        </div>
        <StatusBadge status={k.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>Plan: <span className="text-zinc-300">{k.plan_label}</span></span>
        <span>Created: <span className="text-zinc-300">{fmtDate(k.created_at)}</span></span>
        <span>Expires: <span className="text-zinc-300">{k.expires_at ? fmtDate(k.expires_at) : 'Never'}</span></span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs">
        <Hourglass size={13} className="shrink-0 text-zinc-500" />
        <span className="text-zinc-500">Time remaining:</span>
        <span className="font-medium text-zinc-200">{k.remaining_human}</span>
      </div>
      {k.banned && k.ban_reason && (
        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs text-red-300">
          Ban reason: {k.ban_reason}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
        {/* Ban / Unban */}
        {k.banned ? (
          <button onClick={() => run('unban', `/keys/${k.id}/unban`)} disabled={busy} className="btn justify-center w-full border border-emerald-500/30 bg-emerald-500/10 py-2 text-emerald-300 hover:bg-emerald-500/20">
            {busy === 'unban' ? <Spinner size={14} /> : <ShieldCheck size={14} />} Unban
          </button>
        ) : (
          <div className="flex gap-2">
            <input className="input flex-1 !py-2 text-sm" placeholder="Ban reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button onClick={() => run('ban', `/keys/${k.id}/ban`, { reason })} disabled={busy} className="btn-danger shrink-0 !py-2">
              {busy === 'ban' ? <Spinner size={14} /> : <Ban size={14} />} Ban
            </button>
          </div>
        )}

        {/* Freeze / Unfreeze + Add days */}
        <div className="flex flex-wrap gap-2">
          {k.frozen ? (
            <button onClick={() => run('unfreeze', `/keys/${k.id}/unfreeze`)} disabled={busy} className="btn-ghost flex-1 justify-center !py-2 text-sky-300">
              {busy === 'unfreeze' ? <Spinner size={14} /> : <Play size={14} />} Unfreeze
            </button>
          ) : (
            <button onClick={() => run('freeze', `/keys/${k.id}/freeze`)} disabled={busy || isLifetime} title={isLifetime ? 'Lifetime has no timer to freeze' : 'Pause the timer'} className="btn-ghost flex-1 justify-center !py-2">
              {busy === 'freeze' ? <Spinner size={14} /> : <Snowflake size={14} />} Freeze
            </button>
          )}

          {!isLifetime && (
            <div className="flex flex-[1.6] gap-2">
              <div className="relative flex-1">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input className="input !py-2 pl-8 text-sm" type="number" min="1" placeholder="days" value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
              <button onClick={() => run('add', `/keys/${k.id}/add-days`, { days: dayCount })} disabled={busy || !dayCount} title="Add days" className="btn-ghost shrink-0 !py-2 text-emerald-300">
                {busy === 'add' ? <Spinner size={14} /> : <Plus size={14} />}
              </button>
              <button onClick={() => run('remove', `/keys/${k.id}/add-days`, { days: -dayCount })} disabled={busy || !dayCount} title="Remove days" className="btn-ghost shrink-0 !py-2 text-amber-300">
                {busy === 'remove' ? <Spinner size={14} /> : <Minus size={14} />}
              </button>
            </div>
          )}
        </div>

        {/* Delete membership */}
        <div className="border-t border-white/5 pt-2">
          {confirmDel ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs text-red-300">Delete this membership permanently?</span>
              <button onClick={() => setConfirmDel(false)} disabled={busy} className="btn-ghost !py-1.5 text-xs">Cancel</button>
              <button onClick={del} disabled={busy} className="btn-danger !py-1.5 text-xs">
                {busy === 'delete' ? <Spinner size={13} /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} disabled={busy} className="btn-ghost w-full justify-center !py-2 text-red-300/80 hover:text-red-300">
              <Trash2 size={14} /> Delete membership
            </button>
          )}
        </div>

        {/* Change UUID */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Fingerprint size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input className="input !py-2 pl-8 font-mono text-sm" value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="UUID / HWID" />
          </div>
          <button onClick={() => run('uuid', `/keys/${k.id}/uuid`, { uuid })} disabled={busy || !uuid.trim() || uuid === k.uuid} className="btn-ghost shrink-0 !py-2">
            {busy === 'uuid' ? <Spinner size={14} /> : <Save size={14} />} Save
          </button>
        </div>

        {/* Reset HWID */}
        <button onClick={resetHwid} disabled={busy || !k.uuid} title="Reset HWID - User will need to login again to register new HWID" className="btn-ghost w-full justify-center !py-2 text-amber-300/80 hover:text-amber-300">
          {busy === 'hwid-reset' ? <Spinner size={14} /> : <RotateCcw size={14} />} Reset HWID
        </button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [banned, setBanned] = useState('all');
  const [active, setActive] = useState('all');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'freeze' | 'unfreeze' | 'addTimeAll' | 'removeTimeAll'
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDays, setBulkDays] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    const { data } = await api.get('/users', { params: { q, banned, active } });
    setUsers(data.users);
  }, [q, banned, active]);

  const isTimeBulk = confirm === 'addTimeAll' || confirm === 'removeTimeAll';

  const runBulk = async () => {
    setBulkBusy(true);
    try {
      let res;
      if (confirm === 'freeze') res = await api.post('/keys/freeze-all');
      else if (confirm === 'unfreeze') res = await api.post('/keys/unfreeze-all');
      else {
        const n = Math.abs(parseInt(bulkDays, 10)) || 0;
        if (!n) { toast.error('Enter a number of days.'); setBulkBusy(false); return; }
        res = await api.post('/keys/add-days-all', { days: confirm === 'removeTimeAll' ? -n : n });
      }
      toast.success(`Applied to ${res.data.count} membership(s)`);
      setConfirm(null);
      setBulkDays('');
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBulkBusy(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (u) => {
    setSelected(u);
    setDetail(null);
    try {
      const { data } = await api.get(`/users/${u.discord_id}`);
      setDetail(data.user);
    } catch {
      setDetail(u);
    }
  };

  // Replace a single membership after an action + refresh the list underneath.
  const onMembershipUpdated = (updated) => {
    setDetail((d) => (d ? { ...d, keys: d.keys.map((k) => (k.id === updated.id ? updated : k)) } : d));
    load();
  };

  // Remove a membership after deletion; close the modal if the user has none left.
  const onMembershipDeleted = (id) => {
    setDetail((d) => {
      if (!d) return d;
      const keys = d.keys.filter((k) => k.id !== id);
      if (keys.length === 0) setSelected(null);
      return { ...d, keys };
    });
    load();
  };

  return (
    <div>
      <PageHeader title="Users" subtitle={users ? `${users.length} member(s) — Discord profiles pulled live from Discord ID.` : 'Loading…'}>
        <button onClick={() => setConfirm('freeze')} className="btn-ghost !py-2">
          <Snowflake size={15} /> Freeze all
        </button>
        <button onClick={() => setConfirm('unfreeze')} className="btn-ghost !py-2 text-sky-300">
          <Play size={15} /> Unfreeze all
        </button>
        <button onClick={() => setConfirm('addTimeAll')} className="btn-ghost !py-2 text-emerald-300">
          <Plus size={15} /> Add time all
        </button>
        <button onClick={() => setConfirm('removeTimeAll')} className="btn-ghost !py-2 text-amber-300">
          <Minus size={15} /> Remove time all
        </button>
      </PageHeader>

      <div className="card mb-4 space-y-3 p-4">
        <SearchBar value={q} onChange={setQ} placeholder="Search Discord ID, username or UUID…" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-600"><SlidersHorizontal size={13} /> Filters</div>
          <FilterGroup label="Banned" value={banned} onChange={setBanned}
            options={[{ value: 'all', label: 'Any' }, { value: 'true', label: 'Banned' }, { value: 'false', label: 'Not banned' }]} />
          <FilterGroup label="Access" value={active} onChange={setActive}
            options={[{ value: 'all', label: 'Any' }, { value: 'true', label: 'Has active' }, { value: 'false', label: 'No active' }]} />
        </div>
      </div>

      {!users ? (
        <div className="card"><TableSkeleton /></div>
      ) : users.length === 0 ? (
        <div className="card"><EmptyState icon={UsersIcon} title="No users found" hint="Grant access on the License Key page to add your first member." /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {users.map((u, i) => (
            <motion.button
              key={u.discord_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              onClick={() => open(u)}
              className="card group p-4 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar src={u.discord_avatar} name={u.discord_username} size={48} />
                  {u.banned && (
                    <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-ink-850 bg-red-500 p-0.5"><ShieldBan size={11} className="text-white" /></span>
                  )}
                  {!u.banned && u.frozen && (
                    <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-ink-850 bg-sky-500 p-0.5"><Snowflake size={11} className="text-white" /></span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">{u.discord_username || 'Unknown user'}</div>
                  <div className="truncate font-mono text-xs text-zinc-500">{u.discord_id}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                <Fingerprint size={13} className="shrink-0" />
                <span className="truncate font-mono">{u.latest_uuid || '—'}{u.key_count > 1 ? `  +${u.key_count - 1}` : ''}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-zinc-500">{u.key_count} membership{u.key_count !== 1 ? 's' : ''}</span>
                <StatusBadge status={u.banned ? 'banned' : u.frozen ? 'frozen' : u.has_active ? 'active' : 'expired'} />
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="User details">
        {selected && (
          <div>
            <div className="flex items-center gap-4">
              <Avatar src={(detail || selected).discord_avatar} name={(detail || selected).discord_username} size={60} />
              <div>
                <div className="text-lg font-semibold text-white">{(detail || selected).discord_username || 'Unknown user'}</div>
                <div className="font-mono text-xs text-zinc-500">{selected.discord_id}</div>
                <div className="mt-1"><StatusBadge status={selected.banned ? 'banned' : selected.frozen ? 'frozen' : selected.has_active ? 'active' : 'expired'} /></div>
              </div>
            </div>

            <div className="mt-5 mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500">
              <span>Memberships ({selected.key_count})</span>
              {!detail && <Spinner size={13} />}
            </div>
            <div className="space-y-3">
              {(detail?.keys || selected.keys || []).map((k) => (
                <MembershipCard key={k.id} k={k} onUpdated={onMembershipUpdated} onDeleted={onMembershipDeleted} />
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk action confirmation (freeze / unfreeze / add / remove time — all members) */}
      {(() => {
        const META = {
          freeze: { title: 'Freeze all members?', body: 'This pauses the expiry timer for every active membership at once. No time will be lost — unfreezing restores it.', Icon: Snowflake, tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300', cta: 'Freeze all' },
          unfreeze: { title: 'Unfreeze all members?', body: 'This resumes the expiry timer for every currently frozen membership. Paused time is added back to each expiry date.', Icon: Play, tone: 'border-sky-500/30 bg-sky-500/10 text-sky-300', cta: 'Unfreeze all' },
          addTimeAll: { title: 'Add time to all members?', body: 'Adds the days below to every non-lifetime membership. Lifetime members are skipped.', Icon: Plus, tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', cta: 'Add time', time: true },
          removeTimeAll: { title: 'Remove time from all members?', body: 'Removes the days below from every non-lifetime membership. Lifetime members are skipped.', Icon: Minus, tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300', cta: 'Remove time', time: true },
        };
        const m = META[confirm] || {};
        const Icon = m.Icon || Snowflake;
        return (
          <Modal open={!!confirm} onClose={() => !bulkBusy && setConfirm(null)} title={m.title || ''}>
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${m.tone || ''}`}>
                  <Icon size={18} />
                </div>
                <p className="text-sm text-zinc-400">{m.body}</p>
              </div>
              {m.time && (
                <div>
                  <label className="label">Days</label>
                  <div className="relative">
                    <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input autoFocus type="number" min="1" className="input pl-9" placeholder="e.g. 10" value={bulkDays} onChange={(e) => setBulkDays(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirm(null)} disabled={bulkBusy} className="btn-ghost">Cancel</button>
                <button onClick={runBulk} disabled={bulkBusy || (isTimeBulk && !bulkDays)} className="btn-primary">
                  {bulkBusy ? <Spinner size={14} /> : <Icon size={15} />} {m.cta}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
