import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';

export default function About() {
  return (
    <main className="public-info-page">
      <header className="public-info-nav"><Link className="brand landing-brand" href="/"><span className="brand-mark">R</span> ResTrade</Link><Link href="/register" className="button button-primary button-small">Create account</Link></header>
      <section className="public-info-hero"><span className="hero-kicker">About ResTrade</span><h1>Make every transaction count.</h1><p>ResTrade is a peer-to-peer marketplace built to make buying and selling feel simple, transparent, and secure.</p></section>
      <section className="public-info-grid"><article><span className="eyebrow">Clear by design</span><h2>Know who you are trading with.</h2><p>Profiles, product details, and trust scores help shoppers make informed decisions before they buy.</p></article><article><span className="eyebrow">Protected by escrow</span><h2>Keep funds safe until the handoff.</h2><p>Eligible purchases stay protected while buyers and sellers complete the transaction with confidence.</p></article></section>
      <SiteFooter />
    </main>
  );
}
