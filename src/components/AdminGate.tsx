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
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 font-sans text-ink">
        <div className="max-w-md rounded-xl bg-surface p-8 text-center">
          <Lock size={36} className="mx-auto text-primary" strokeWidth={1.75} />
          <h1 className="display mt-4 text-2xl text-ink">Админ-панель не активирована</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Supabase не настроен. Создайте проект, выполните SQL-скрипты из папки supabase/, добавьте
            VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в переменные окружения — инструкция в README.
          </p>
          <a
            href="#top"
            onClick={() => (window.location.hash = '')}
            className="mt-5 inline-block text-sm font-semibold text-primary-dark hover:underline"
          >
            ← На сайт
          </a>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 size={30} className="animate-spin text-primary" />
      </div>
    );
  }

  if (authed) return <AdminDashboard />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 font-sans text-ink">
      <form onSubmit={handleLogin} className="w-full max-w-sm rounded-xl bg-surface p-8">
        <Lock size={32} className="mx-auto text-primary" strokeWidth={1.75} />
        <h1 className="display mt-4 text-center text-3xl text-ink">Вход для админа</h1>
        <div className="mt-6 space-y-2.5">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            autoComplete="username"
            required
            className="w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Пароль"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn-press mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />} Войти
        </button>
      </form>
    </div>
  );
}
