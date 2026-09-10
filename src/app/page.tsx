'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import SiteFooter from './components/SiteFooter';

export default function Home() {
  const [status, setStatus] = useState('Checking connection...');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkConnection = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        setStatus(`Connection failed: ${error.message}`);
      } else {
        setIsLoggedIn(Boolean(data.session));
        setStatus('Supabase connected successfully! Ready to build ResTrade.');
      }
    };

    checkConnection();
  }, []);

  return (
    <main className="landing-page">
      <header className="landing-nav"><Link className="brand landing-brand" href="/"> <span className="brand-mark">R</span> ResTrade</Link><nav><Link href="/marketplace">Marketplace</Link>{isLoggedIn ? <span className="landing-auth-disabled" aria-disabled="true">Log in</span> : <Link href="/login">Log in</Link>}{isLoggedIn ? <span className="button button-primary button-small landing-auth-disabled" aria-disabled="true">Sign up</span> : <Link className="button button-primary button-small" href="/register">Sign up</Link>}</nav></header>
      <section className="landing-hero"><div className="hero-copy"><span className="hero-kicker">• Protected peer-to-peer commerce</span><h1>Trade with confidence.<br /><em>Move forward.</em></h1><p>ResTrade makes buying and selling online feel simple, transparent, and secure from the first click to the final handoff.</p><div className="hero-actions"><button type="button" onClick={() => router.push(isLoggedIn ? '/dashboard' : '/register')} className="button button-primary hero-button">Start trading</button><Link href="/marketplace" className="button hero-secondary">Explore marketplace <span>→</span></Link></div><div className="trust-row"><span>✓ Escrow protected</span><span>✓ Verified profiles</span></div></div><div className="hero-art"><div className="art-glow" /><div className="art-card"><span className="art-check">✓</span><span>Escrow</span><strong>GH₵ 2,450.00</strong><small>Funds secured</small></div><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /></div></section>
      <section className="landing-strip"><span>Built for better transactions</span><strong>Buy safely</strong><strong>Sell simply</strong><strong>Trust every step</strong></section>
      <SiteFooter />
      <p className="status-note">{status}</p>
    </main>
  );
}