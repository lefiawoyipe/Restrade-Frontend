'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import SiteShell from '../components/SiteShell';

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
  description?: string;
  price: number;
  status: string;
}

interface OrderSummary {
  id: string;
  amount: number;
  status: string;
  productTitle: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // User Data State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({ products: 0, active: 0, completed: 0 });

  // New Product Form State
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Check if user is logged in
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        router.replace('/login');
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

      // 4. Count: Products (Listed by you)
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', uid);

      // 5. Count: Orders (Active Escrow purchases)
      const { count: activeOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', uid)
        .eq('status', 'escrow_funded');

      // 6. Count: Purchases (Completed safely)
      const { count: completedOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', uid)
        .eq('status', 'completed');

      // Store stats
      setStats({
        products: productsCount || 0,
        active: activeOrdersCount || 0,
        completed: completedOrdersCount || 0,
      });

      // 7. Fetch Products Listed by this User (for inventory display)
      const { data: productData } = await supabase
        .from('products')
        .select('id, title, description, price, status')
        .eq('seller_id', uid)
        .order('created_at', { ascending: false });

      if (productData) setMyProducts(productData);

      // 8. Fetch Recent Orders (limit to 3 for dashboard preview)
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, amount, status, products(title)')
        .eq('buyer_id', uid)
        .order('created_at', { ascending: false })
        .limit(3);

      if (orderData) {
        setOrders(orderData.map((order: { id: string; amount: number; status: string; products?: { title?: string }[] | null }) => ({
          id: order.id,
          amount: order.amount,
          status: order.status,
          productTitle: order.products?.[0]?.title || 'Unknown product',
        })));
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    const input = prompt('How many simulated Ghana Cedis (GH₵) would you like to add to your test wallet? (Max: 10,000)');
    if (!input) return;

    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid number greater than 0.');
      return;
    }

    const { error } = await supabase.rpc('fund_wallet', { p_amount: amount });

    if (error) {
      alert(`Top-up failed: ${error.message}`);
    } else {
      alert(`Successfully added GH₵ ${amount.toFixed(2)} to your wallet!`);
      fetchDashboardData(); // Refresh the balance display on the screen
    }
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setIsSubmitting(true);

    let imageUrl: string | null = null;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        alert(`Image upload failed: ${uploadError.message}`);
        setIsSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    let dbError;
    const isEditing = Boolean(editingProductId);

    if (editingProductId) {
      const updateData: {
        title: string;
        description: string;
        price: number;
        image_url?: string;
      } = {
        title: newTitle,
        description: newDescription,
        price: parseFloat(newPrice),
      };

      if (imageUrl) updateData.image_url = imageUrl;

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', editingProductId)
        .eq('seller_id', userId);
      dbError = error;
    } else {
      const { error } = await supabase.from('products').insert([
        {
          seller_id: userId,
          title: newTitle,
          description: newDescription,
          price: parseFloat(newPrice),
          status: 'available',
          image_url: imageUrl,
        }
      ]);
      dbError = error;
    }

    setIsSubmitting(false);

    if (dbError) {
      alert(`Error saving product: ${dbError.message}`);
    } else {
      // Reset form and refresh product list
      setNewTitle('');
      setNewDescription('');
      setNewPrice('');
      setImageFile(null);
      setShowForm(false);
      setEditingProductId(null);
      fetchDashboardData(); 
      alert(isEditing ? 'Listing updated!' : 'Listing published!');
    }
  };

  const handleEditClick = (product: Product) => {
    setNewTitle(product.title);
    setNewPrice(product.price.toString());
    setNewDescription(product.description || '');
    setEditingProductId(product.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingProductId(null);
    setNewTitle('');
    setNewPrice('');
    setNewDescription('');
    setImageFile(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-lg font-medium text-gray-600">Loading your secure dashboard...</p>
      </div>
    );
  }

  return (
    <SiteShell title="Overview" eyebrow="Good morning">
    <main className="min-h-screen bg-transparent p-0">
      <div className="mx-auto max-w-5xl">
        
        {/* Header Section */}
        <header className="mb-6 flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Trust Score: {profile?.total_reviews ? <><span className="font-semibold text-blue-600">{profile.trust_score} / 5.0</span> ({profile.total_reviews} reviews)</> : <span className="font-semibold text-gray-500">— · No reviews yet</span>}
            </p>
          </div>
        <div className="flex flex-wrap gap-3">
            <Link 
              href="/orders"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              My Orders 
            </Link>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3" aria-label="Account summary">
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Products</p><p className="mt-2 text-2xl font-bold text-gray-800">{stats.products}</p><p className="mt-1 text-xs text-gray-500">Listed by you</p></div>
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Orders</p><p className="mt-2 text-2xl font-bold text-gray-800">{stats.active}</p><p className="mt-1 text-xs text-gray-500">Escrow purchases</p></div>
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Purchases</p><p className="mt-2 text-2xl font-bold text-gray-800">{stats.completed}</p><p className="mt-1 text-xs text-gray-500">Completed safely</p></div>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          
          {/* Left Column: Wallet & Actions */}
          <div className="space-y-6 md:col-span-1">
            
           {/* Wallet Card */}
            <div className="rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white shadow-md flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-medium text-blue-100 opacity-80">Test Wallet</h2>
                <p className="mt-2 text-4xl font-bold">GH₵ {wallet?.balance?.toFixed(2) || '0.00'}</p>
                <p className="mt-2 text-xs text-blue-200">Secured by ResTrade Escrow</p>
              </div>
              <button
                onClick={handleTopUp}
                className="mt-6 w-full rounded bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30 backdrop-blur-sm border border-white/30"
              >
                + Top Up Test Balance
              </button>
            </div>

          </div>

          <div className="space-y-6 md:col-span-2">
            <section className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-gray-800">Recent Orders</h2><Link href="/orders" className="text-sm font-semibold text-blue-600 hover:underline">View all</Link></div>
              {orders.length === 0 ? (
                <div className="rounded border-2 border-dashed border-gray-200 p-7 text-center"><p className="text-sm text-gray-500">No orders yet.</p><Link href="/marketplace" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">Browse Marketplace</Link></div>
              ) : (
                <div className="space-y-3">{orders.slice(0, 3).map((order) => <div key={order.id} className="flex items-center justify-between rounded border border-gray-100 p-3"><div><p className="font-semibold text-gray-800">{order.productTitle}</p><p className="text-xs text-gray-500">GH₵ {order.amount.toFixed(2)}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">{order.status.replace('_', ' ')}</span></div>)}</div>
              )}
            </section>
            
            {/* Conditional Listing Form */}
            {showForm && (
              <div className="rounded-lg bg-white p-6 shadow-md border-t-4 border-green-500 animate-in fade-in slide-in-from-top-4">
                <h3 className="mb-4 text-lg font-bold text-gray-800">{editingProductId ? 'Edit Listing' : 'Create a Listing'}</h3>
                <form onSubmit={handleSubmitListing} className="space-y-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="w-full rounded border border-gray-300 p-2 focus:border-green-500 focus:outline-none file:mr-4 file:rounded file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-green-700 hover:file:bg-green-100"
                    />
                  </div>
                  <button 
                    type="submit" disabled={isSubmitting}
                    className="w-full rounded bg-green-600 p-2 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {isSubmitting ? 'Saving...' : editingProductId ? 'Save Changes' : 'Publish to Marketplace'}
                  </button>
                </form>
              </div>
            )}

            {/* User's Products Grid */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-gray-800">Your Inventory</h3>
                <button
                  onClick={showForm ? handleCancelForm : () => setShowForm(true)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${showForm ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {showForm ? 'Cancel Listing' : '+ List Product'}
                </button>
              </div>
              
              {myProducts.length === 0 ? (
                <div className="rounded border-2 border-dashed border-gray-200 p-8 text-center text-gray-500">
                  <p>You haven&apos;t listed any products yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myProducts.map((product) => (
                    <div key={product.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded border border-gray-100 p-4 transition hover:bg-gray-50">
                      <div>
                        <h4 className="font-semibold text-gray-800">{product.title}</h4>
                        <p className="text-sm font-medium text-blue-600">GH₵ {product.price.toFixed(2)}</p>
                      </div>
                      <div className="mt-3 sm:mt-0 flex items-center gap-3">
                        {product.status === 'available' && (
                          <button
                            type="button"
                            onClick={() => handleEditClick(product)}
                            className="text-xs font-semibold text-gray-500 hover:text-blue-600 underline"
                          >
                            Edit
                          </button>
                        )}
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full 
                          ${product.status === 'available' ? 'bg-green-100 text-green-800' : 
                            product.status === 'in_escrow' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'}`}
                        >
                          {product.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </main>
    </SiteShell>
  );
}