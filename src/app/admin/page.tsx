'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import SiteShell from '../components/SiteShell';

interface DisputedOrder {
  id: string;
  amount: number;
  product_title: string;
  buyer_name: string;
  seller_name: string;
}

export default function AdminPortal() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<DisputedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndFetchDisputes();
  }, []);

  const checkAdminAndFetchDisputes = async () => {
    // 1. Verify Authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      router.replace('/login');
      return;
    }

    // 2. Verify Admin Role
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      alert('Access Denied: You do not have administrator privileges.');
      router.push('/dashboard');
      return;
    }

    // 3. If Admin, fetch the disputes
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, 
        amount, 
        products (title),
        buyer:profiles!orders_buyer_id_fkey (full_name),
        seller:products (profiles!products_seller_id_fkey (full_name))
      `)
      .eq('status', 'disputed');

    if (data) {
      const formatted = data.map((item: any) => ({
        id: item.id,
        amount: item.amount,
        product_title: item.products?.title || 'Unknown Product',
        buyer_name: item.buyer?.full_name || 'Unknown Buyer',
        seller_name: item.seller?.profiles?.full_name || 'Unknown Seller',
      }));
      setDisputes(formatted);
    }
    setLoading(false);
  };

  const handleResolve = async (orderId: string, favorBuyer: boolean) => {
    if (!confirm(`Are you sure you want to ${favorBuyer ? 'REFUND THE BUYER' : 'PAY THE SELLER'}? This action cannot be undone.`)) return;
    
    setProcessingId(orderId);
    const { error } = await supabase.rpc('resolve_dispute', {
      p_order_id: orderId,
      p_favor_buyer: favorBuyer
    });
    setProcessingId(null);

    if (error) {
      alert(`Error resolving dispute: ${error.message}`);
    } else {
      alert(`Dispute resolved! Funds have been securely transferred.`);
      checkAdminAndFetchDisputes();
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center p-6 bg-slate-900 text-white"><p>Verifying Administrator Credentials...</p></div>;
  }

  return (
    <SiteShell title="Dispute resolution" eyebrow="Admin workspace">
    <main className="min-h-screen bg-transparent text-white p-0">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between border-b border-slate-700 pb-6">
          <div>
            <span className="rounded bg-red-600 px-2 py-1 text-xs font-bold uppercase tracking-widest">System Admin</span>
            <h1 className="text-3xl font-extrabold mt-2">Dispute Resolution Command Center</h1>
            <p className="text-slate-400 mt-1">Review frozen escrow transactions and mechanically enforce fair outcomes.</p>
          </div>
          <Link href="/dashboard" className="rounded bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700">
            Exit Admin
          </Link>
        </header>

        {disputes.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-12 text-center">
            <h2 className="text-xl font-medium text-slate-300">No active disputes 🎉</h2>
            <p className="text-slate-500 mt-2">All peer-to-peer transactions are currently running smoothly.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => (
              <div key={d.id} className="rounded-lg border border-red-500/30 bg-slate-800 p-6 shadow-lg">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <span className="text-xs font-mono text-red-400">DISPUTED ORDER: {d.id}</span>
                    <h3 className="text-xl font-bold text-white mt-1">{d.product_title} — <span className="text-green-400">GH₵ {d.amount.toFixed(2)}</span></h3>
                    <div className="mt-3 flex gap-6 text-sm">
                      <p className="text-slate-300">Buyer: <strong className="text-white">{d.buyer_name}</strong></p>
                      <p className="text-slate-300">Seller: <strong className="text-white">{d.seller_name}</strong></p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-700">
                    <button
                      onClick={() => handleResolve(d.id, true)}
                      disabled={processingId === d.id}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      🛡️ Refund Buyer (GH₵ {d.amount.toFixed(2)})
                    </button>
                    <button
                      onClick={() => handleResolve(d.id, false)}
                      disabled={processingId === d.id}
                      className="rounded bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      ⚖️ Pay Seller (Override)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
    </SiteShell>
  );
}