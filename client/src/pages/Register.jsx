import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, UserPlus, Eye, EyeOff, Ticket } from 'lucide-react';
import api, { apiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast, Spinner } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';
import TwoFactorSetup from '../components/TwoFactorSetup.jsx';

export default function Register() {
  const [step, setStep] = useState('form'); // form | setup
  const [form, setForm] = useState({ key: '', username: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setup, setSetup] = useState(null);
  const toast = useToast();
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match.');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      setSetup(data);
      setStep('setup');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const onDone = (data) => {
    login(data.token, data.user);
    navigate('/dashboard');
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AuthShell>
      <AnimatePresence mode="wait">
        {step === 'form' ? (
          <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="mb-6 text-xs font-medium uppercase tracking-widest text-zinc-500">Step 1 — Create account</div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Create your admin account</h2>
            <p className="mt-2 text-sm text-zinc-400">You'll set up two-factor authentication next.</p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="label">Registration key</label>
                <div className="relative">
                  <Ticket size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    className="input pl-10 font-mono uppercase tracking-wide placeholder:tracking-normal placeholder:normal-case"
                    placeholder="RAYX-REG-XXXXX-XXXXX"
                    value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toUpperCase() }))}
                    autoFocus
                    required
                  />
                </div>
                <p className="mt-1.5 text-xs text-zinc-600">Generated with <span className="font-mono text-zinc-400">createkey.py</span>. Required to create an account.</p>
              </div>
              <div>
                <label className="label">Username</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input className="input pl-10" placeholder="yourname" value={form.username} onChange={set('username')} required />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    className="input pl-10 pr-10"
                    type={show ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={set('password')}
                    required
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input className="input pl-10" type={show ? 'text' : 'password'} placeholder="••••••••" value={form.confirm} onChange={set('confirm')} required />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : <UserPlus size={16} />}
                Continue
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-white underline-offset-4 hover:underline">Sign in</Link>
            </p>
          </motion.div>
        ) : (
          <motion.div key="setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <TwoFactorSetup qr={setup.qr} secret={setup.secret} setupToken={setup.setupToken} onDone={onDone} />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
