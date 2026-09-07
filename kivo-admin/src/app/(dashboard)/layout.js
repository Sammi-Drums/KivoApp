'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/layout/Sidebar';
import { IconLoader2 } from '@tabler/icons-react';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      // Confirm they're an admin
      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!admin) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }
      setChecking(false);
    }
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0D1829',
      }}>
        <IconLoader2 size={40} color="#00D46A" style={{ animation: 'kivospin 0.8s linear infinite' }} />
        <style>{`@keyframes kivospin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0D1829' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '28px 32px', overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
