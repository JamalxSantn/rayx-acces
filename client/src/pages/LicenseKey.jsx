import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Check, CircleUserRound, Search, Fingerprint, ShieldCheck } from 'lucide-react';
import api, { apiError } from '../api.js';
import { PageHeader, useToast, Spinner, Avatar, StatusBadge, fmtDate } from '../components/ui.jsx';

const PLANS = [
  { value: 'month', label: 'Month', sub: '30 days' },
  { value: '3months', label: '3 Months', sub: '90 days' },
  { value: 'year', label: 'Year', sub: '365 days' },
  { value: 'lifetime', label: 'Lifetime', sub: 'Never expires' },
];

export default function LicenseKey() {
  const [discordId, setDiscordId] = useState('');
  const [uuid, setUuid] = useState('');
  const [plan, setPlan] = useState('month');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const toast = useToast();

  const check = async () => {
    if (!/^\d{17,20}$/.test(discordId.trim())) return toast.error('Enter a valid Discord ID (17-20 digits).');
    setChecking(true);
    setPreview(null);
    try {
      const { data } = await api.get(`/keys/lookup/${discordId.trim()}`);
      const l = data.lookup;
      if (l.exists) setPreview({ username: l.username, avatar: l.avatar });
      else if (l.exists === false) setPreview({ invalid: true });
      else setPreview({ unknown: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setChecking(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!uuid.trim()) return toast.error('Enter a UUID.');
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/keys', { discord_id: discordId.trim(), uuid: uuid.trim(), plan });
      setResult(data);
      toast.success('Member granted access');
      setUuid('');
      setPreview(null);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="License Key" subtitle="Grant a user access by their Discord ID and UUID. The Discord ID is validated as a real account." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card space-y-6 p-6 lg:col-span-3">
          {/* Discord ID */}
          <div>
            <label className="label">Discord ID</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <CircleUserRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  className="input pl-10 font-mono"
                  placeholder="e.g. 159985870458322944"
                  value={discordId}
                  onChange={(e) => { setDiscordId(e.target.value.replace(/\D/g, '')); setPreview(null); }}
                />
              </div>
              <button type="button" onClick={check} disabled={checking} className="btn-ghost shrink-0">
                {checking ? <Spinner size={15} /> : <Search size={15} />} Verify
              </button>
            </div>

            <AnimatePresence>
              {preview && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3">
                  {preview.invalid ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">No Discord account exists with that ID.</div>
                  ) : preview.unknown ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-300">Couldn't reach Discord to confirm right now — it will be re-checked on submit.</div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
                      <Avatar src={preview.avatar} name={preview.username} size={38} />
                      <div>
                        <div className="text-sm font-medium text-white">{preview.username}</div>
                        <div className="text-xs text-emerald-400">Valid Discord account ✓</div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* UUID */}
          <div>
            <label className="label">UUID</label>
            <div className="relative">
              <Fingerprint size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="input pl-10 font-mono"
                placeholder="Player / HWID UUID"
                value={uuid}
                onChange={(e) => setUuid(e.target.value)}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-600">The identifier the game server will validate against this member.</p>
          </div>

          {/* Plan */}
          <div>
            <label className="label">Plan / Duration</label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {PLANS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlan(p.value)}
                  className={`relative rounded-xl border p-3 text-left transition ${
                    plan === p.value ? 'border-white/40 bg-white/[0.08]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{p.label}</div>
                  <div className="text-xs text-zinc-500">{p.sub}</div>
                  {plan === p.value && <Check size={14} className="absolute right-2 top-2 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading || !discordId || !uuid} className="btn-primary w-full">
            {loading ? <Spinner /> : <UserPlus size={16} />}
            Grant access
          </button>

          <p className="text-xs text-zinc-600">This whitelists the member site-side. A game server can validate the same UUID later.</p>
        </motion.form>

        {/* Result */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card flex flex-col p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 font-medium text-white"><ShieldCheck size={16} /> Access granted</div>
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div key="res" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-1 flex-col">
                <div className="flex items-center gap-3">
                  <Avatar src={result.key.discord_avatar} name={result.key.discord_username} size={44} />
                  <div>
                    <div className="text-sm font-medium text-white">{result.key.discord_username || 'Unknown'}</div>
                    <div className="font-mono text-xs text-zinc-500">{result.key.discord_id}</div>
                  </div>
                </div>
                <div className="mt-4 gradient-border rounded-xl bg-ink-800/60 p-4">
                  <div className="mb-1 text-xs uppercase tracking-wider text-zinc-500">UUID</div>
                  <code className="break-all font-mono text-sm text-white">{result.key.uuid}</code>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <Row k="Plan" v={result.key.plan_label} />
                  <Row k="Created" v={fmtDate(result.key.created_at)} />
                  <Row k="Expires" v={result.key.expires_at ? fmtDate(result.key.expires_at) : 'Never (Lifetime)'} />
                  <Row k="Status" v={<StatusBadge status={result.key.status} />} />
                </dl>
              </motion.div>
            ) : (
              <motion.div key="empty" className="flex flex-1 flex-col items-center justify-center text-center text-sm text-zinc-500">
                <Fingerprint size={26} className="mb-3 text-zinc-600" />
                The granted member will appear here.
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between border-t border-white/5 pt-2">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="font-medium text-zinc-200">{v}</dd>
    </div>
  );
}
