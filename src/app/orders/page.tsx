'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import SiteShell from '../components/SiteShell';

interface Order {
  id: string;
  amount: number;
  status: string;
  product_id: string;
  product_title: string;
  seller_id: string;
  seller_name: string;
}

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Review Form State
  const [activeReviewOrderId, setActiveReviewOrderId] = useState<string | null>(null);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      router.replace('/login');
      return;
    }

    const uid = session.user.id;
    setUserId(uid);

    // Fetch orders where the current user is the BUYER, joining product and seller details
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, 
        amount, 
        status, 
        product_id,
        products (
          title,
          seller_id,
          profiles!products_seller_id_fkey (full_name)
        )
      `)
      .eq('buyer_id', uid)
      .order('created_at', { ascending: false });

    if (data) {
      const formatted: Order[] = data.map((item: any) => ({
        id: item.id,
        amount: item.amount,
        status: item.status,
        product_id: item.product_id,
        product_title: item.products?.title || 'Unknown Product',
        seller_id: item.products?.seller_id,
        seller_name: item.products?.profiles?.full_name || 'Unknown Seller',
      }));
      setOrders(formatted);
    }
    setLoading(false);
  };

  const handleReleaseEscrow = async (orderId: string) => {
    if (!userId) return;
    setProcessingId(orderId);
  
    // Call our PostgreSQL function to release funds to the seller!
    const { error } = await supabase.rpc('release_escrow', {
      p_order_id: orderId
    });

    setProcessingId(null);

    if (error) {
      alert(`Failed to release escrow: ${error.message}`);
    } else {
      alert('Escrow Released! The seller has received their funds.');
      fetchOrders(); // Refresh order status to "completed"
    }
  };

  const handleRaiseDispute = async (orderId: string) => {
    if (!userId) return;
    if (!confirm('Are you sure you want to dispute this order? Funds will be frozen until an Admin reviews it.')) return;

    setProcessingId(orderId);
    const { error } = await supabase.rpc('raise_dispute', {
      p_order_id: orderId
    });
    setProcessingId(null);

    if (error) {
      alert(`Error raising dispute: ${error.message}`);
    } else {
      alert('Dispute has been raised. Funds are frozen pending admin review.');
      fetchOrders();
    }
  };

  const handleSubmitReview = async (order: Order) => {
    if (!userId) return;
    setSubmittingReview(true);

    const { error } = await supabase.from('reviews').insert([
      {
        order_id: order.id,
        reviewer_id: userId,
        seller_id: order.seller_id,
        rating: parseInt(rating),
        comment: comment,
      }
    ]);

    setSubmittingReview(false);

    if (error) {
      alert(`Error submitting review: ${error.message} (You may have already reviewed this order!)`);
    } else {
      alert('Review submitted! The seller\'s Trust Score has been dynamically updated.');
      setActiveReviewOrderId(null);
      setComment('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-lg font-medium text-gray-600">Loading your escrow transactions...</p>
      </div>
    );
  }

  return (
    <SiteShell title="My orders" eyebrow="Your trading activity">
    <main className="min-h-screen bg-transparent p-0">
      <div className="mx-auto max-w-4xl">
        
        {/* Header Section */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Escrow Orders</h1>
            <p className="text-gray-500 mt-1">Manage your purchases and release funds when items arrive.</p>
          </div>
          <Link 
            href="/dashboard"
            className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>
        </header>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-medium text-gray-600">No active orders found.</h2>
            <p className="text-gray-400 mt-2">Visit the marketplace to start trading safely!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Order ID: {order.id.slice(0, 8)}...</span>
                    <h3 className="text-xl font-bold text-gray-800 mt-1">{order.product_title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Seller: <span className="font-semibold text-gray-800">{order.seller_name}</span> | 
                      Amount Locked: <span className="font-bold text-blue-600">GH₵ {order.amount.toFixed(2)}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full 
                      ${order.status === 'escrow_funded' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 
                        order.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-300' : 
                        'bg-gray-100 text-gray-800'}`}
                    >
                      {order.status === 'escrow_funded' ? '🔒 FUNDS IN ESCROW' : order.status.toUpperCase()}
                    </span>

                    {/* Action Button: Release Escrow */}
                    {order.status === 'escrow_funded' && (
                      <button
                        onClick={() => handleReleaseEscrow(order.id)}
                        disabled={processingId === order.id}
                        className="rounded bg-green-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-green-700 disabled:bg-gray-400"
                      >
                        {processingId === order.id ? 'Releasing...' : '✓ Confirm Receipt & Release Funds'}
                      </button>
                    )}

                    {/* Action Button: Dispute Order */}
                    {order.status === 'escrow_funded' && (
                      <button
                        onClick={() => handleRaiseDispute(order.id)}
                        disabled={processingId === order.id}
                        className="rounded border border-red-500 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        ⚠️ Report Issue / Dispute
                      </button>
                    )}

                    {/* Action Button: Leave Review */}
                    {order.status === 'completed' && (
                      <button
                        onClick={() => setActiveReviewOrderId(activeReviewOrderId === order.id ? null : order.id)}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {activeReviewOrderId === order.id ? 'Close Review Form' : '★ Leave Seller Review'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Review Form */}
                {activeReviewOrderId === order.id && (
                  <div className="mt-6 border-t pt-4 bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-lg animate-in fade-in">
                    <h4 className="font-bold text-gray-800 mb-3">Rate your experience with {order.seller_name}</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Rating</label>
                        <select 
                          value={rating} 
                          onChange={(e) => setRating(e.target.value)}
                          className="rounded border border-gray-300 p-2 text-sm bg-white font-medium focus:outline-none focus:border-blue-500"
                        >
                          <option value="5">★★★★★ (5/5) - Excellent & Trustworthy</option>
                          <option value="4">★★★★☆ (4/5) - Good Transaction</option>
                          <option value="3">★★★☆☆ (3/5) - Average</option>
                          <option value="2">★★☆☆☆ (2/5) - Poor Experience</option>
                          <option value="1">★☆☆☆☆ (1/5) - Fraudulent / Bad</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Comment</label>
                        <input
                          type="text"
                          placeholder="e.g., Laptop was exactly as described, smooth transaction!"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <button
                        onClick={() => handleSubmitReview(order)}
                        disabled={submittingReview}
                        className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
    </SiteShell>
  );
}