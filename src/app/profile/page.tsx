'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import SiteShell from '../components/SiteShell';

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [trust, setTrust] = useState(0);
  const [reviews, setReviews] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      setEmail(session.user.email || '');
      const { data } = await supabase.from('profiles').select('full_name, trust_score, total_reviews').eq('id', session.user.id).single();
      if (data) { setName(data.full_name || ''); setTrust(data.trust_score || 0); setReviews(data.total_reviews || 0); }
    };
    loadProfile();
  }, [router]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setMessage('');
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', session.user.id);
      setMessage(error ? error.message : 'Profile updated successfully.');
    }
    setSaving(false);
  };

  return <SiteShell title="Profile" eyebrow="Your public trading identity"><div className="settings-grid"><section className="panel account-card"><div className="profile-avatar">{name.slice(0, 2).toUpperCase() || 'RT'}</div><h2>{name || 'Your profile'}</h2><p>{email}</p><div className="profile-score"><strong>{trust.toFixed(1)}</strong><span>Trust score<br />{reviews} reviews</span></div></section><section className="panel settings-panel"><div className="settings-heading"><div><span className="eyebrow">Personal details</span><h2>Profile information</h2></div></div><form onSubmit={saveProfile} className="settings-form"><label>Full name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Email address<input value={email} readOnly /></label>{message && <p className="form-message">{message}</p>}<button className="button button-primary settings-submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></form></section></div></SiteShell>;
}
