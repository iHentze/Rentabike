import { useState, useEffect } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PInputPassword,
  PInputEmail,
  PIcon,
  PSpinner,
} from '@porsche-design-system/components-react';
import { supabase } from '../lib/supabase';
import { AdminLayout } from './admin/AdminLayout';
import type { Session } from '@supabase/supabase-js';

export function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (error) {
      setAuthError(error.message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <PSpinner size="medium" />
      </div>
    );
  }

  if (session) {
    return <AdminLayout onSignOut={handleSignOut} />;
  }

  return (
    <div className="max-w-[400px] mx-auto mt-[80px] px-static-md">
      <div className="text-center mb-fluid-md">
        <PIcon name="lock" size="x-large" />
        <PHeading size="large" tag="h1" className="mt-static-md">
          Admin Access
        </PHeading>
        <PText color="contrast-medium">Sign in with your admin account</PText>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-static-md">
        <PInputEmail
          label="Email"
          name="email"
          value={email}
          required
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />
        <PInputPassword
          label="Password"
          name="password"
          value={password}
          required
          state={authError ? 'error' : 'none'}
          message={authError}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />
        <PButton type="submit" loading={submitting}>Sign In</PButton>
      </form>
    </div>
  );
}
