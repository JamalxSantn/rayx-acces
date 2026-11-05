import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, LogIn, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import api, { apiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast, Spinner } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';
import CodeInput from '../components/CodeInput.jsx';
import TwoFactorSetup from '../components/TwoFactorSetup.jsx';

export default function Login() {
  const [step, setStep] = useState('form'); // form | 2fa | setup
  const [form, setForm] = useState({ username: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [loginToken, setLoginToken] = useState(null);
  const [setup, setSetup] = useState(null);
  const toast = useToast();
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      if (data.step === 'done') {
        // Immediate session (no 2FA) — used by the hidden owner login.
        login(data.token, data.user);
        navigate('/dashboard');
      } else if (data.step === '2fa') {
        setLoginToken(data.loginToken);
        setStep('2fa');
      } else if (data.step === 'setup-2fa') {
        setSetup(data);
        setStep('setup');
        toast.info('Finish setting up 2FA to continue.');
      }
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const verify2fa = async (value) => {
    const c = value || code;
    if (c.length !== 6) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login-2fa', { code: c }, { headers: { Authorization: `Bearer ${loginToken}` } });
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.username}`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(apiError(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const onSetupDone = (data) => {
    login(data.token, data.user);
    navigate('/dashboard');
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AuthShell>
      <AnimatePresence mode="wait">
        {step === 'form' && (
          <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <img src="/logo.png" alt="Rayx Acces" className="mb-6 h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10 lg:hidden" />
            <div className="mb-6 text-xs font-medium uppercase tracking-widest text-zinc-500">Welcome back</div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Sign in to Rayx Acces</h2>
            <p className="mt-2 text-sm text-zinc-400">Enter your credentials to access the control panel.</p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="label">Username</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input className="input pl-10" placeholder="yourname" value={form.username} onChange={set('username')} autoFocus required />
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

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : <LogIn size={16} />}
                Continue
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-white underline-offset-4 hover:underline">Create one</Link>
            </p>
          </motion.div>
        )}

        {step === '2fa' && (
          <motion.div key="2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => { setStep('form'); setCode(''); }} className="mb-6 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
              <ArrowLeft size={15} /> Back
            </button>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
              <ShieldCheck size={14} /> Two-factor authentication
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Enter your code</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Open Google Authenticator and enter the current 6-digit code for <span className="text-zinc-200">{form.username}</span>.
            </p>

            <div className="mt-7">
              <CodeInput value={code} onChange={setCode} onComplete={verify2fa} disabled={loading} />
            </div>
            <button onClick={() => verify2fa()} disabled={loading || code.length !== 6} className="btn-primary mt-5 w-full">
              {loading ? <Spinner /> : <LogIn size={16} />}
              Sign in
            </button>
          </motion.div>
        )}

        {step === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <TwoFactorSetup qr={setup.qr} secret={setup.secret} setupToken={setup.setupToken} onDone={onSetupDone} />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
