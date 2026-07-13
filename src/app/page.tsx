'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [status, setStatus] = useState('Checking connection...');

  useEffect(() => {
    const checkConnection = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        setStatus(`Connection failed: ${error.message}`);
      } else {
        setStatus('Supabase connected successfully! Ready to build ResTrade.');
      }
    };

    checkConnection();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-4 text-2xl font-bold text-gray-800">System Status</h1>
        <p className="text-gray-600 font-medium">{status}</p>
      </div>
    </main>
  );
}