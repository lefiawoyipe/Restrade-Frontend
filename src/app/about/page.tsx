 'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import SiteFooter from '../components/SiteFooter';

export default function About() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(Boolean(data.session));
    };

    checkSession();
  }, []);

  return (
    <main className="landing-page about-page">
      <header className="landing-nav"><Link className="brand landing-brand" href="/"><span className="brand-mark">R</span> ResTrade</Link><nav><Link href="/marketplace">Marketplace</Link>{isLoggedIn ? <span className="landing-auth-disabled" aria-disabled="true">Log in</span> : <Link href="/login">Log in</Link>}{isLoggedIn ? <span className="button button-primary button-small landing-auth-disabled" aria-disabled="true">Sign up</span> : <Link className="button button-primary button-small" href="/register">Sign up</Link>}</nav></header>
      <section className="landing-hero"><div className="hero-copy"><span className="hero-kicker">• Protected peer-to-peer commerce</span><h1>Trade with confidence.<br /><em>Move forward.</em></h1><p>ResTrade makes buying and selling online feel simple, transparent, and secure from the first click to the final handoff.</p><div className="hero-actions"><button type="button" onClick={() => router.push(isLoggedIn ? '/dashboard' : '/register')} className="button button-primary hero-button">Start trading</button><Link href="/marketplace" className="button hero-secondary">Explore marketplace <span>→</span></Link></div><div className="trust-row"><span>✓ Escrow protected</span><span>✓ Verified profiles</span></div></div><div className="hero-art"><div className="art-glow" /><div className="art-card"><span className="art-check">✓</span><span>Escrow</span><strong>GH₵ 2,450.00</strong><small>Funds secured</small></div><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /></div></section>
      <section className="trust-details" aria-labelledby="trust-details-title">
        <div className="escrow-flow">
          <div className="trust-section-heading"><div><span className="eyebrow">How ResTrade protects your money</span><h2 id="trust-details-title">A clear path from payment to payout.</h2></div><span className="escrow-badge">Protected by design</span><p>Escrow keeps the funds secure while both sides complete the handoff.</p></div>
          <ol className="escrow-steps">
            <li><span className="step-number">1</span><div><strong>Buyer pays</strong><p>Money enters secure escrow.</p></div><span className="step-arrow" aria-hidden="true">→</span></li>
            <li><span className="step-number">2</span><div><strong>Seller ships or delivers</strong><p>Payment is secured for the seller.</p></div><span className="step-arrow" aria-hidden="true">→</span></li>
            <li><span className="step-number">3</span><div><strong>Buyer confirms</strong><p>Product arrives and is verified.</p></div><span className="step-arrow" aria-hidden="true">→</span></li>
            <li><span className="step-number">4</span><div><strong>Seller gets paid</strong><p>Funds are released.</p></div></li>
          </ol>
          <div className="dispute-note"><strong>Problem?</strong><span>Open a dispute before funds are released.</span></div>
        </div>
        <article className="reputation-card">
          <div className="reputation-topline"><span className="eyebrow">Reputation management</span><span className="verified-pill">Verified seller</span></div>
          <h2>Seller reputation</h2>
          <div className="reputation-score"><strong>4.8</strong><div><span aria-label="5 out of 5 stars">★★★★★</span><small>out of 5</small></div></div>
          <p className="transaction-count"><strong>127</strong> completed transactions</p>
          <ul className="verification-list">
            <li><span>Identity</span><strong>Verified</strong></li>
            <li><span>Email</span><strong>Verified</strong></li>
            <li><span>Phone</span><strong>Verified</strong></li>
          </ul>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
