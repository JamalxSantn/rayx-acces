import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Plus, Maximize2 } from 'lucide-react';
import api, { apiError } from '../api.js';
import {
  PageHeader, Modal, EmptyState, Spinner, Avatar, StatusBadge, useToast, fmtDate,
} from '../components/ui.jsx';

export default function ScreenShots() {
  const [shots, setShots] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: '', image_url: '', discord_id: '', note: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = async () => {
    const { data } = await api.get('/screenshots');
    setShots(data.screenshots);
  };
  useEffect(() => { load(); }, []);

  const open = async (s) => {
    setSelected(s);
    setDetail(null);
    try {
      const { data } = await api.get(`/screenshots/${s.id}`);
      setDetail(data);
    } catch {
      setDetail({ screenshot: s, holder: null });
    }
  };

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/screenshots', form);
      toast.success('Screenshot added');
      setAddOpen(false);
      setForm({ title: '', image_url: '', discord_id: '', note: '' });
      load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="ScreenShots" subtitle="Captured evidence gallery. Click a shot for full holder details.">
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus size={16} /> Add screenshot</button>
      </PageHeader>

      {!shots ? (
        <div className="flex justify-center py-16"><Spinner size={22} /></div>
      ) : shots.length === 0 ? (
        <div className="card"><EmptyState icon={ImageIcon} title="No screenshots yet" hint="Add your first capture." /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shots.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              onClick={() => open(s)}
              className="card group overflow-hidden text-left"
            >
              <div className="relative aspect-video overflow-hidden bg-ink-800">
                <img src={s.image_url} alt={s.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" onError={(e) => (e.target.style.opacity = 0.2)} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="absolute right-3 top-3 rounded-lg bg-black/50 p-1.5 opacity-0 backdrop-blur transition group-hover:opacity-100">
                  <Maximize2 size={14} className="text-white" />
                </div>
              </div>
              <div className="p-4">
                <div className="truncate font-medium text-white">{s.title}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{fmtDate(s.created_at)}</div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Screenshot details" wide>
        {selected && (
          <div>
            <div className="overflow-hidden rounded-xl border border-white/10">
              <img src={selected.image_url} alt={selected.title} className="max-h-[46vh] w-full object-contain bg-black" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">{selected.title}</h3>
            {selected.note && <p className="mt-1 text-sm text-zinc-400">{selected.note}</p>}
            <div className="mt-1 text-xs text-zinc-500">Captured {fmtDate(selected.created_at)}</div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Holder</div>
              {!detail ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500"><Spinner size={14} /> Loading holder…</div>
              ) : detail.holder ? (
                <div>
                  <div className="flex items-center gap-4">
                    <Avatar src={detail.holder.discord_avatar} name={detail.holder.discord_username} size={52} />
                    <div>
                      <div className="text-base font-semibold text-white">{detail.holder.discord_username || 'Unknown user'}</div>
                      <div className="font-mono text-xs text-zinc-500">{detail.holder.discord_id}</div>
                      <div className="mt-1"><StatusBadge status={detail.holder.banned ? 'banned' : detail.holder.keys?.some((k) => k.status === 'active') ? 'active' : 'expired'} /></div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {detail.holder.keys?.map((k) => (
                      <div key={k.id} className="rounded-xl border border-white/10 bg-ink-800/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <code className="truncate font-mono text-xs text-zinc-300">{k.uuid || '—'}</code>
                          <StatusBadge status={k.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                          <span>Plan: <span className="text-zinc-300">{k.plan_label}</span></span>
                          <span>Created: <span className="text-zinc-300">{fmtDate(k.created_at)}</span></span>
                          <span>Expires: <span className="text-zinc-300">{k.expires_at ? fmtDate(k.expires_at) : 'Never'}</span></span>
                        </div>
                      </div>
                    ))}
                    {(!detail.holder.keys || detail.holder.keys.length === 0) && (
                      <div className="text-sm text-zinc-500">This Discord ID has no license keys yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-500">No holder linked to this screenshot.</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add screenshot">
        <form onSubmit={add} className="space-y-4">
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></div>
          <div><label className="label">Image URL</label><input className="input" placeholder="https://…" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} required /></div>
          <div><label className="label">Discord ID (optional)</label><input className="input font-mono" value={form.discord_id} onChange={(e) => setForm((f) => ({ ...f, discord_id: e.target.value.replace(/\D/g, '') }))} /></div>
          <div><label className="label">Note (optional)</label><textarea className="input min-h-[80px] resize-y" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner /> : <Plus size={16} />} Add</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
