'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import SiteShell from '../components/SiteShell';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  seller: {
    full_name: string;
    trust_score: number;
  };
}

export default function Marketplace() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMarketplace();
  }, []);

  const fetchMarketplace = async () => {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      router.replace('/login');
      return;
    }

    setUserId(session.user.id);

    // Fetch all 'available' products that do NOT belong to the current user
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, 
        title, 
        description, 
        price, 
        image_url,
        seller_id,
        profiles!products_seller_id_fkey(full_name, trust_score)
      `)
      .eq('status', 'available')
      .neq('seller_id', session.user.id)
      .order('created_at', { ascending: false });

    if (data) {
      // Map the relational data to match our interface
      const formattedData = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        price: item.price,
        image_url: item.image_url,
        seller: {
          full_name: item.profiles.full_name,
          trust_score: item.profiles.trust_score,
        }
      }));
      setProducts(formattedData);
    }
    setLoading(false);
  };

  const handlePurchase = async (productId: string) => {
    if (!userId) return;
    setProcessingId(productId);

    // Call the exact PostgreSQL Stored Procedure we wrote in Phase 4
    const { error } = await supabase.rpc('initiate_purchase', {
      p_buyer_id: userId,
      p_product_id: productId
    });

    setProcessingId(null);

    if (error) {
      alert(`Transaction Failed: ${error.message}`);
    } else {
      alert('Success! Funds moved to Escrow. The seller will be notified.');
      // Refresh the marketplace to remove the purchased item
      fetchMarketplace();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-lg font-medium text-gray-600">Loading marketplace...</p>
      </div>
    );
  }

  return (
    <SiteShell title="Marketplace" eyebrow="Discover something useful">
    <main className="min-h-screen bg-transparent p-0">
      <div className="mx-auto max-w-5xl">
        
        {/* Header Section */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Marketplace</h1>
            <p className="text-gray-500 mt-1">Safely buy items using ResTrade Escrow.</p>
          </div>
          <Link 
            href="/dashboard"
            className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>
        </header>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-medium text-gray-600">No items available right now.</h2>
            <p className="text-gray-400 mt-2">Check back later when sellers list new products.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} className="flex flex-col justify-between rounded-lg bg-white p-6 shadow-sm border border-gray-100 transition hover:shadow-md">
                <div>
                  {product.image_url ? (
                    <div className="relative mb-4 h-48 w-full overflow-hidden rounded-md border border-gray-100">
                      <Image
                        src={product.image_url}
                        alt={product.title}
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 flex h-48 w-full items-center justify-center rounded-md border border-gray-200 bg-gray-100">
                      <span className="text-sm text-gray-400">No Image</span>
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-gray-800">{product.title}</h3>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{product.description}</p>
                  
                  <div className="mt-4 rounded bg-gray-50 p-3 text-sm">
                    <p className="text-gray-600">Seller: <span className="font-medium text-gray-800">{product.seller.full_name}</span></p>
                    <p className="text-gray-600">Trust Score: <span className="font-semibold text-blue-600">{product.seller.trust_score} / 5.0</span></p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <span className="text-xl font-bold text-gray-800">GH₵ {product.price.toFixed(2)}</span>
                  <button 
                    onClick={() => handlePurchase(product.id)}
                    disabled={processingId === product.id}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {processingId === product.id ? 'Processing...' : 'Buy Safely'}
                  </button>
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