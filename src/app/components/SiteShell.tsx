'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SiteFooter from './SiteFooter';
import overviewIcon from '@/icon images/overview.png';
import marketplaceIcon from '@/icon images/marketplace.png';
import ordersIcon from '@/icon images/orders.png';
import profileIcon from '@/icon images/profile.png';
import settingsIcon from '@/icon images/settings.png';
import logoutIcon from '@/icon images/logout.png';
import goBackIcon from '@/icon images/goback.png';

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: overviewIcon },
  { href: '/marketplace', label: 'Marketplace', icon: marketplaceIcon },
  { href: '/orders', label: 'Orders', icon: ordersIcon },
];

export default function SiteShell({ children, title, eyebrow }: { children: React.ReactNode; title?: string; eyebrow?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeGreeting, setTimeGreeting] = useState('Good morning');
  const [profileInitials, setProfileInitials] = useState('RT');

  useEffect(() => {
    const greetingTimer = window.setTimeout(() => {
      const hour = new Date().getUTCHours();
      setTimeGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    }, 0);

    return () => window.clearTimeout(greetingTimer);
  }, []);

  useEffect(() => {
    const loadProfileInitials = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      const fullName = profile?.full_name || session.user.user_metadata?.full_name || '';
      if (fullName) setProfileInitials(fullName.slice(0, 2).toUpperCase());
    };

    loadProfileInitials();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className={`app-frame ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Link href="/dashboard" className="brand" title="ResTrade home"><span className="brand-mark">R</span> ResTrade</Link>
        <p className="nav-label">Workspace</p>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-label={item.label} title={sidebarOpen ? undefined : item.label} className={`side-link ${pathname === item.href ? 'active' : ''}`}>
              <span className="side-icon"><Image src={item.icon} alt="" width={18} height={18} /></span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="help-box"><strong>Trade with confidence</strong><span>Every purchase is protected by escrow.</span></div>
        <nav className="side-nav" aria-label="Account navigation">
          <Link href="/profile" aria-label="Profile" title={sidebarOpen ? undefined : 'Profile'} className="side-link"><span className="side-icon"><Image src={profileIcon} alt="" width={18} height={18} /></span>Profile</Link>
          <Link href="/settings" aria-label="Settings" title={sidebarOpen ? undefined : 'Settings'} className="side-link"><span className="side-icon"><Image src={settingsIcon} alt="" width={18} height={18} /></span>Settings</Link>
          <button type="button" aria-label="Log Out" title={sidebarOpen ? undefined : 'Log Out'} className="side-link logout-link" onClick={handleLogout}><span className="side-icon"><Image src={logoutIcon} alt="" width={18} height={18} /></span>Log Out</button>
        </nav>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="topbar-heading"><button className="sidebar-toggle" type="button" title={sidebarOpen ? 'Close navigation' : 'Open navigation'} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}><span aria-hidden="true">{sidebarOpen ? '×' : '☰'}</span></button><div><span className="topbar-eyebrow">{eyebrow === 'Good morning' ? timeGreeting : eyebrow || 'ResTrade workspace'}</span>{title && <h1 className="topbar-title">{title}</h1>}</div></div>
          <div className="topbar-actions">{pathname === '/marketplace' ? <button type="button" className="back-button" onClick={handleGoBack} title="Go back" aria-label="Go back"><Image src={goBackIcon} alt="" width={24} height={24} /></button> : <Link href="/marketplace" className="button button-primary button-small">Browse marketplace</Link>}<Link href="/profile" className="avatar-link" title="Open profile" aria-label="Open profile"><span className="avatar">{profileInitials}</span></Link></div>
        </header>
        <main className="page-content">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}