import { useRef } from 'react';

// Controlled 6-digit code input with auto-advance, backspace and paste support.
export default function CodeInput({ value, onChange, onComplete, disabled }) {
  const refs = useRef([]);

  const commit = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    return clean;
  };

  const handleChange = (i, e) => {
    const typed = e.target.value.replace(/\D/g, '');
    if (!typed) return;
    const next = (value.slice(0, i) + typed + value.slice(i + typed.length)).slice(0, 6);
    const clean = commit(next);
    const focusIdx = Math.min(i + typed.length, 5);
    refs.current[focusIdx]?.focus();
    if (clean.length === 6) onComplete?.(clean);
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) {
        commit(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        commit(value.slice(0, i - 1));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const clean = commit(e.clipboardData.getData('text'));
    refs.current[Math.min(clean.length, 5)]?.focus();
    if (clean.length === 6) onComplete?.(clean);
  };

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          className="h-14 w-full rounded-xl border border-white/10 bg-ink-800/70 text-center text-xl font-semibold text-white outline-none transition focus:border-white/30 focus:ring-4 focus:ring-white/5 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
