'use client';

import Link from 'next/link';
import Image from 'next/image';
import instagramIcon from '@/icon images/ig.png';
import xIcon from '@/icon images/twitterx.png';
import tiktokIcon from '@/icon images/tiktok.png';

const companyLinks = [
  { href: '/about', label: 'About ResTrade' },
  { href: '/settings', label: 'Privacy & settings' },
  { href: '/orders', label: 'Dispute & refunds' },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link href="/dashboard" className="footer-brand"><span className="brand-mark">R</span> ResTrade</Link>
        <div className="footer-socials" aria-label="Social media links">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="ResTrade on Instagram" title="Instagram"><Image src={instagramIcon} alt="" width={22} height={22} /></a>
          <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="ResTrade on X" title="X"><Image src={xIcon} alt="" width={22} height={22} /></a>
          <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="ResTrade on TikTok" title="TikTok"><Image src={tiktokIcon} alt="" width={22} height={22} /></a>
        </div>
      </div>
      <div className="footer-columns">
        <div className="footer-column"><h2>For shoppers</h2><Link href="/marketplace">Find products</Link><Link href="/orders">My orders</Link><Link href="/profile">Account profile</Link></div>
        <div className="footer-column"><h2>For sellers</h2><Link href="/dashboard">List a product</Link><Link href="/dashboard">Your inventory</Link></div>
        <div className="footer-column"><h2>Company</h2>{companyLinks.map((link) => <Link key={link.label} href={link.href}>{link.label}</Link>)}</div>
        <div className="footer-column"><h2>Contact us</h2><span>Accra, Ghana</span><a href="mailto:support@restrade.app">support@restrade.app</a><span>Protected by ResTrade Escrow</span></div>
      </div>
      <div className="footer-bottom"><span>Peer-to-peer commerce made clearer and safer.</span><span>© 2026 ResTrade. All rights reserved.</span></div>
    </footer>
  );
}
