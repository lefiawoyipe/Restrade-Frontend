'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName, // This maps to raw_user_meta_data->>'full_name' in your DB trigger
        },
      },
    });

    setLoading(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Registration successful! Please check your email for a verification link.');
      setTimeout(() => router.push('/login'), 3000);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual"><Link href="/" className="brand"><span className="brand-mark">R</span> ResTrade</Link><div><h1>Make every transaction count.</h1><p>Join a marketplace where clear profiles and protected escrow make moving goods feel easy.</p></div><span className="nav-label">Start your trusted profile</span></section>
      <section className="auth-form-wrap"><div className="auth-card"><h2>Create your account</h2><p>Set up your ResTrade profile in less than a minute.</p>
        
        {message && (
          <div className="auth-error">
            {message}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              className="w-full rounded border border-gray-300 p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

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
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-foot">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Log In
          </Link>
        </p>
        <div className="auth-company-link"><strong>New to ResTrade?</strong><span>Learn how our marketplace and protected escrow work.</span><Link href="/about">About ResTrade →</Link></div>
      </div></section>
    </main>
  );
}