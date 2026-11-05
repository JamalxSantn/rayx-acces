import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessagesSquare } from 'lucide-react';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHeader, timeAgo } from '../components/ui.jsx';

export default function StaffChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const bottom = useRef(null);
  const scroller = useRef(null);
  const { user } = useAuth();

  const scrollDown = () => bottom.current?.scrollIntoView({ behavior: 'smooth' });

  const poll = useCallback(async () => {
    try {
      const { data } = await api.get('/community/chat', { params: { since: lastId.current } });
      if (data.messages.length) {
        lastId.current = data.messages[data.messages.length - 1].id;
        setMessages((m) => [...m, ...data.messages]);
        setTimeout(scrollDown, 60);
      }
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 2500);
    return () => clearInterval(iv);
  }, [poll]);

  const send = async (e) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setText('');
    setSending(true);
    try {
      await api.post('/community/chat', { message: msg });
      await poll();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[420px] flex-col">
      <PageHeader title="Staff Chat" subtitle="A shared channel for the whole team." />

      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-zinc-500">
              <MessagesSquare size={28} className="mb-3 text-zinc-600" />
              No messages yet. Say hello
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const mine = m.username === user?.username;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[75%] gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${mine ? 'bg-white text-black' : 'bg-gradient-to-br from-ink-600 to-ink-800 text-zinc-300'}`}>
                      {m.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className={`mb-1 flex items-center gap-2 text-xs text-zinc-500 ${mine ? 'justify-end' : ''}`}>
                        <span className="font-medium text-zinc-400">{mine ? 'You' : m.username}</span>
                        <span>{timeAgo(m.created_at)}</span>
                      </div>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? 'rounded-tr-sm bg-white text-black' : 'rounded-tl-sm border border-white/10 bg-ink-800/70 text-zinc-200'}`}>
                        {m.message}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={bottom} />
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-white/10 p-3">
          <input
            className="input flex-1"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <button type="submit" disabled={sending || !text.trim()} className="btn-primary aspect-square !px-3">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
