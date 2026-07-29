import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import AdminDashboard from './AdminDashboard';

/**
 * Admin entry point (#/admin). Supabase email+password auth; the dashboard is
 * rendered only for an authenticated session. UI is Russian-only — the panel
 * is internal.
 */
export default function AdminGate() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session));
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (authError) {
      setError('Неверный email или пароль.');
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 font-sans text-cocoa">
        <div className="max-w-md rounded-3xl bg-card p-8 text-center shadow-lg">
          <Lock size={40} className="mx-auto text-caramel" />
          <h1 className="mt-4 font-serif text-2xl font-semibold">Админ-панель недоступна</h1>
          <p className="mt-2 text-sm text-taupe">
            Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env и выполните
            supabase/schema.sql.
          </p>
          <a href="#top" onClick={() => (window.location.hash = '')} className="mt-4 inline-block text-sm font-semibold text-caramel">
            ← На сайт
          </a>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 size={32} className="animate-spin text-caramel" />
      </div>
    );
  }

  if (authed) return <AdminDashboard />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 font-sans text-cocoa">
      <form onSubmit={handleLogin} className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-lg">
        <Lock size={36} className="mx-auto text-caramel" />
        <h1 className="mt-4 text-center font-serif text-3xl font-semibold">Вход для админа</h1>
        <div className="mt-6 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            autoComplete="username"
            required
            className="w-full rounded-xl border border-cocoa/15 bg-cream px-4 py-3 text-sm outline-none focus:border-caramel"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Пароль"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-cocoa/15 bg-cream px-4 py-3 text-sm outline-none focus:border-caramel"
          />
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-caramel px-5 py-3 font-semibold text-cream hover:bg-caramel-dark disabled:opacity-60"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />} Войти
        </button>
      </form>
    </div>
  );
}
