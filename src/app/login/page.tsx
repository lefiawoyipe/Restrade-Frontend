'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      router.push('/dashboard'); // We will build the main dashboard next
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual"><Link href="/" className="brand"><span className="brand-mark">R</span> ResTrade</Link><div><h1>Good trades start with trust.</h1><p>One clear place to discover products, protect your payment, and build a reputation that travels with you.</p></div><span className="nav-label">Secure peer-to-peer commerce</span></section>
      <section className="auth-form-wrap"><div className="auth-card"><h2>Welcome back</h2><p>Log in to continue to your ResTrade workspace.</p>
        
        {errorMsg && (
          <div className="auth-error">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full rounded border border-gray-300 p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full rounded border border-gray-300 p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button button-primary"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="auth-foot">
          Don't have an account yet?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div></section>
    </main>
  );
}