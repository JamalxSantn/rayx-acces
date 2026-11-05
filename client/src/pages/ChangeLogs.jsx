import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Plus, Trash2 } from 'lucide-react';
import api, { apiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  PageHeader, SearchBar, FilterGroup, Badge, Modal, EmptyState, Spinner, useToast, timeAgo,
} from '../components/ui.jsx';

const TAGS = [
  { value: 'update', label: 'Update' },
  { value: 'feature', label: 'Feature' },
  { value: 'fix', label: 'Fix' },
  { value: 'announcement', label: 'Announcement' },
];

export default function ChangeLogs() {
  const [logs, setLogs] = useState(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', tag: 'update' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const load = useCallback(async () => {
    const { data } = await api.get('/community/changelogs', { params: { q, tag } });
    setLogs(data.changelogs);
  }, [q, tag]);

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/community/changelogs', form);
      toast.success('Changelog posted');
      setOpen(false);
      setForm({ title: '', body: '', tag: 'update' });
      load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    try {
      await api.delete(`/community/changelogs/${id}`);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader title="ChangeLogs" subtitle="What's new — anyone on the team can post an update.">
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> New changelog</button>
      </PageHeader>

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <SearchBar value={q} onChange={setQ} placeholder="Search changelogs…" />
        <FilterGroup value={tag} onChange={setTag} options={[{ value: 'all', label: 'All' }, ...TAGS]} />
      </div>

      {!logs ? (
        <div className="flex justify-center py-16"><Spinner size={22} /></div>
      ) : logs.length === 0 ? (
        <div className="card"><EmptyState icon={ScrollText} title="No changelogs yet" hint="Post the first update for your team." /></div>
      ) : (
        <div className="relative space-y-3 before:absolute before:left-[7px] before:top-2 before:h-full before:w-px before:bg-white/10">
          {logs.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="relative pl-8"
            >
              <span className="absolute left-0 top-4 h-3.5 w-3.5 rounded-full border-2 border-ink-950 bg-white" />
              <div className="card group p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone={c.tag}>{c.tag}</Badge>
                      <span className="text-xs text-zinc-500">by {c.author} · {timeAgo(c.created_at)}</span>
                    </div>
                    <h3 className="text-base font-semibold text-white">{c.title}</h3>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{c.body}</p>
                  </div>
                  {c.author === user?.username && (
                    <button onClick={() => del(c.id)} className="rounded-lg p-2 text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Post a changelog">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Added anti-cheat module" autoFocus required />
          </div>
          <div>
            <label className="label">Tag</label>
            <FilterGroup value={form.tag} onChange={(v) => setForm((f) => ({ ...f, tag: v }))} options={TAGS} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[120px] resize-y" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Describe what changed…" required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner /> : <Plus size={16} />} Post</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
