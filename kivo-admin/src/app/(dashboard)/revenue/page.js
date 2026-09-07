'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import { IconCoin, IconTrendingUp, IconWallet, IconLoader2 } from '@tabler/icons-react';

export default function RevenuePage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: completed } = await supabase
        .from('trips').select('fare, created_at').eq('trip_status', 'completed');
      const trips = completed || [];
      const totalFares = trips.reduce((s, t) => s + Number(t.fare || 0), 0);
      const platformCut = Math.round(totalFares * 0.15);
      const driverCut = totalFares - platformCut;

      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthFares = trips.filter(t => new Date(t.created_at) >= startMonth).reduce((s, t) => s + Number(t.fare || 0), 0);

      setStats({
        totalFares, platformCut, driverCut,
        completedCount: trips.length,
        monthCommission: Math.round(monthFares * 0.15),
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader title="Revenue" subtitle="Platform earnings from completed trips" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Big icon={IconCoin} label="Platform Commission (15%)" value={`${stats.platformCut.toLocaleString()} FCFA`} color={C.primary} />
        <Big icon={IconWallet} label="Driver Payouts (85%)" value={`${stats.driverCut.toLocaleString()} FCFA`} color={C.info} />
        <Big icon={IconTrendingUp} label="Total Fares Collected" value={`${stats.totalFares.toLocaleString()} FCFA`} color={C.warn} />
        <Big icon={IconCoin} label="This Month's Commission" value={`${stats.monthCommission.toLocaleString()} FCFA`} color={C.primary} />
      </div>
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
        <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>
          Based on <strong style={{ color: C.text }}>{stats.completedCount}</strong> completed trips.
          Commission rate is 15% (adjustable in Settings).
        </p>
      </div>
    </div>
  );
}

function Big({ icon: Icon, label, value, color }) {
  return (
    <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={color} />
        </div>
        <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{value}</div>
    </div>
  );
}
function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
    <IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} />
    <style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
  </div>;
}
