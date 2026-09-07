'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import Avatar from '@/components/ui/Avatar';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { IconRefresh, IconLoader2 } from '@tabler/icons-react';

export default function PassengersPage() {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPassengers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('passengers')
      .select('id, full_name, preferred_payment_method, created_at, city:cities(city_name), user:users(email, phone_number)')
      .order('created_at', { ascending: false });
    setPassengers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPassengers(); }, [fetchPassengers]);

  const columns = [
    {
      key: 'name', header: 'Passenger',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={row.full_name} />
          <div>
            <div style={{ fontWeight: 600 }}>{row.full_name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{row.user?.email || '—'}</div>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (row) => row.user?.phone_number || '—' },
    { key: 'city', header: 'City', render: (row) => row.city?.city_name || '—' },
    {
      key: 'payment', header: 'Payment',
      render: (row) => <Badge color={C.info}>{row.preferred_payment_method || 'cash'}</Badge>,
    },
    {
      key: 'created_at', header: 'Joined',
      render: (row) => new Date(row.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Passengers"
        subtitle={`${passengers.length} passenger${passengers.length !== 1 ? 's' : ''} registered`}
        actions={
          <button onClick={fetchPassengers}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <IconRefresh size={16} /> Refresh
          </button>
        }
      />

      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} />
            <style>{`@keyframes kivospin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <DataTable columns={columns} rows={passengers} emptyText="No passengers yet." />
        )}
      </div>
    </div>
  );
}
