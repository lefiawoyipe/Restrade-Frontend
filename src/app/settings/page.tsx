'use client';

import { useState } from 'react';
import SiteShell from '../components/SiteShell';

export default function SettingsPage() {
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [saved, setSaved] = useState(false);
  const save = (event: React.FormEvent) => { event.preventDefault(); setSaved(true); };

  return <SiteShell title="Settings" eyebrow="Make ResTrade yours"><div className="settings-grid single"><section className="panel settings-panel"><div className="settings-heading"><div><span className="eyebrow">Preferences</span><h2>Notifications</h2><p>Choose how you want to hear from ResTrade.</p></div></div><form onSubmit={save} className="settings-form"><label className="toggle-row"><span><strong>Order updates</strong><small>Get alerts when escrow status changes.</small></span><input type="checkbox" checked={orderAlerts} onChange={(event) => setOrderAlerts(event.target.checked)} /><i /></label><label className="toggle-row"><span><strong>Marketplace updates</strong><small>Receive occasional notes about new listings.</small></span><input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} /><i /></label><div className="settings-divider" /><div><span className="eyebrow">Security</span><h2 className="settings-subtitle">Account security</h2></div><button className="button button-primary settings-submit">{saved ? 'Preferences saved' : 'Save preferences'}</button></form></section><section className="panel settings-panel"><div className="settings-heading"><div><span className="eyebrow">About ResTrade</span><h2>Protected by design</h2><p>Escrow holds funds securely until you confirm your order. Your trust score grows with every fair transaction.</p></div></div><div className="security-note"><span>✓</span><div><strong>Escrow protection enabled</strong><p>Your purchases are covered from payment to delivery.</p></div></div></section></div></SiteShell>;
}
