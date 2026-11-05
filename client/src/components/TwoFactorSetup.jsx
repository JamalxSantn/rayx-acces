import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ShieldCheck, Smartphone } from 'lucide-react';
import api, { apiError } from '../api.js';
import { useToast, Spinner } from './ui.jsx';
import CodeInput from './CodeInput.jsx';

// Shown after register (or when resuming). Displays QR + secret, verifies first code.
export default function TwoFactorSetup({ qr, secret, setupToken, onDone }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const verify = async (value) => {
    const c = value || code;
    if (c.length !== 6) return;
    setLoading(true);
    try {
      const { data } = await api.post(
        '/auth/verify-setup',
        { code: c },
        { headers: { Authorization: `Bearer ${setupToken}` } }
      );
      toast.success('Two-factor authentication enabled');
      onDone(data);
    } catch (e) {
      toast.error(apiError(e));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard?.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
        <Smartphone size={14} /> Step 2 — Set up Google Authenticator
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-white">Scan the QR code</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Open <span className="text-zinc-200">Google Authenticator</span> (or any TOTP app), scan the code,
        then enter the 6-digit code to finish.
      </p>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto mt-6 w-fit rounded-2xl border border-white/10 bg-white p-3 shadow-glow"
      >
        {qr ? (
          <img src={qr} alt="2FA QR code" width={200} height={200} className="rounded-lg" />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center">
            <Spinner />
          </div>
        )}
      </motion.div>

      <div className="mt-4">
        <div className="mb-1.5 text-center text-xs text-zinc-500">Can't scan? Enter this key manually</div>
        <button
          onClick={copySecret}
          className="mx-auto flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-zinc-300 hover:border-white/20"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          {secret}
        </button>
      </div>

      <div className="mt-6">
        <label className="label text-center">Enter the 6-digit code</label>
        <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={loading} />
      </div>

      <button onClick={() => verify()} disabled={loading || code.length !== 6} className="btn-primary mt-5 w-full">
        {loading ? <Spinner /> : <ShieldCheck size={16} />}
        Verify & enable 2FA
      </button>
    </div>
  );
}
