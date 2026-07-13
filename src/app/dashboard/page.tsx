'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// Define TypeScript interfaces for our database records
interface Profile {
  full_name: string;
  trust_score: number;
  total_reviews: number;
}

interface Wallet {
  balance: number;
}

interface Product {
  id: string;
  title: string;
  price: number;
  status: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // User Data State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // New Product Form State
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Check if user is logged in
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        router.push('/login');
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      // 2. Fetch Profile (Full Name, Trust Score)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      
      if (profileData) setProfile(profileData);

      // 3. Fetch Wallet Balance
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', uid)
        .single();
      
      if (walletData) setWallet(walletData);

      // 4. Fetch Products Listed by this User
      const { data: productData } = await supabase
        .from('products')
        .select('id, title, price, status')
        .eq('seller_id', uid)
        .order('created_at', { ascending: false });

      if (productData) setMyProducts(productData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleListProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setIsSubmitting(true);

    const { error } = await supabase.from('products').insert([
      {
        seller_id: userId,
        title: newTitle,
        description: newDescription,
        price: parseFloat(newPrice),
        status: 'available',
      }
    ]);

    setIsSubmitting(false);

    if (error) {
      alert(`Error listing product: ${error.message}`);
    } else {
      // Reset form and refresh product list
      setNewTitle('');
      setNewDescription('');
      setNewPrice('');
      setShowForm(false);
      fetchDashboardData(); 
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-lg font-medium text-gray-600">Loading your secure dashboard...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        
        {/* Header Section */}
        <header className="mb-8 flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Trust Score: <span className="font-semibold text-blue-600">{profile?.trust_score} / 5.0</span> 
              {' '} ({profile?.total_reviews} reviews)
            </p>
          </div>
        <div className="flex flex-wrap gap-3">
            <Link 
              href="/marketplace"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Browse Marketplace
            </Link>
            <Link 
              href="/orders"
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              My Orders 📦
            </Link>
            <button 
              onClick={handleLogout}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Log Out
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          
          {/* Left Column: Wallet & Actions */}
          <div className="space-y-6 md:col-span-1">
            
            {/* Wallet Card */}
            <div className="rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white shadow-md">
              <h2 className="text-sm font-medium text-blue-100 opacity-80">Simulated Balance</h2>
              <p className="mt-2 text-4xl font-bold">GH₵ {wallet?.balance?.toFixed(2) || '0.00'}</p>
              <p className="mt-4 text-xs text-blue-200">Secured by ResTrade Escrow</p>
            </div>

            {/* List Product Action */}
            <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">Seller Actions</h2>
              <button 
                onClick={() => setShowForm(!showForm)}
                className="w-full rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                {showForm ? 'Cancel Listing' : '+ List New Product'}
              </button>
            </div>

          </div>

          {/* Right Column: Marketplace Activity */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Conditional Listing Form */}
            {showForm && (
              <div className="rounded-lg bg-white p-6 shadow-md border-t-4 border-green-500 animate-in fade-in slide-in-from-top-4">
                <h3 className="mb-4 text-lg font-bold text-gray-800">Create a Listing</h3>
                <form onSubmit={handleListProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Title</label>
                    <input 
                      type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full rounded border border-gray-300 p-2 focus:border-green-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (GH₵)</label>
                    <input 
                      type="number" step="0.01" min="1" required value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full rounded border border-gray-300 p-2 focus:border-green-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      rows={3} required value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                      className="w-full rounded border border-gray-300 p-2 focus:border-green-500 focus:outline-none"
                    />
                  </div>
                  <button 
                    type="submit" disabled={isSubmitting}
                    className="w-full rounded bg-green-600 p-2 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish to Marketplace'}
                  </button>
                </form>
              </div>
            )}

            {/* User's Products Grid */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-gray-800">Your Inventory</h3>
              
              {myProducts.length === 0 ? (
                <div className="rounded border-2 border-dashed border-gray-200 p-8 text-center text-gray-500">
                  You haven't listed any products yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {myProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between rounded border border-gray-100 p-4 transition hover:bg-gray-50">
                      <div>
                        <h4 className="font-semibold text-gray-800">{product.title}</h4>
                        <p className="text-sm font-medium text-blue-600">GH₵ {product.price.toFixed(2)}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full 
                        ${product.status === 'available' ? 'bg-green-100 text-green-800' : 
                          product.status === 'in_escrow' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-gray-100 text-gray-800'}`}
                      >
                        {product.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}