import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const bufRef = useRef('');
  const timerRef = useRef(null);
  const busyRef = useRef(false);

  // Only on the /localhost 404 page: capture typed characters and stream the
  // buffer to the server, which matches it against the secret. The phrase is
  // never present in this bundle.
  useEffect(() => {
    if (location.pathname !== '/localhost') return;

    const attempt = async () => {
      if (busyRef.current) return;
      const buffer = bufRef.current;
      if (buffer.length < 6) return;
      busyRef.current = true;
      try {
        const { data } = await api.post('/auth/secret', { phrase: buffer });
        if (data?.token) {
          bufRef.current = '';
          login(data.token, data.user);
          navigate('/dashboard');
        }
      } catch {
        /* wrong phrase — stay on the 404 page silently */
      } finally {
        busyRef.current = false;
      }
    };

    const onKey = (e) => {
      if (!e.key || e.key.length !== 1) return; // ignore Shift, arrows, etc.
      bufRef.current = (bufRef.current + e.key).slice(-40);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(attempt, 350);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timerRef.current);
    };
  }, [login, navigate, location.pathname]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-950 px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(circle at 50% 40%, black, transparent 75%)',
        }}
      />
      <div className="relative">
        <div className="text-[7rem] font-bold leading-none tracking-tighter text-white/90 sm:text-[9rem]">404</div>
        <div className="mt-1 text-lg font-medium text-zinc-300">Not Found</div>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
          The page you are looking for doesn&rsquo;t exist or may have been moved.
        </p>
        <button onClick={() => navigate('/login')} className="btn-primary mx-auto mt-8">
          Back to sign in
        </button>
      </div>
    </div>
  );
}
