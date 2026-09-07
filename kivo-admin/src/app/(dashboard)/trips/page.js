'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import { IconRefresh, IconLoader2 } from '@tabler/icons-react';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TripsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('trips')
      .select('id, trip_code, pickup_location, dropoff_location, fare, trip_status, ride_tier, created_at, passenger:passengers(full_name), driver:drivers(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter !== 'all') query = query.eq('trip_status', filter);
    const { data } = await query;
    setTrips(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const columns = [
    { key: 'trip_code', header: 'Code', render: (row) => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.textMuted }}>{row.trip_code}</span> },
    {
      key: 'route', header: 'Route',
      render: (row) => (
        <div style={{ fontSize: 13 }}>
          <div style={{ color: C.text }}>{row.pickup_location}</div>
          <div style={{ color: C.textMuted, fontSize: 12 }}>→ {row.dropoff_location}</div>
        </div>
      ),
    },
    { key: 'passenger', header: 'Passenger', render: (row) => row.passenger?.full_name || '—' },
    { key: 'driver', header: 'Driver', render: (row) => row.driver?.full_name || <span style={{ color: C.textFaint }}>Unassigned</span> },
    { key: 'tier', header: 'Tier', render: (row) => row.ride_tier ? <Badge color={C.info}>{row.ride_tier}</Badge> : '—' },
    { key: 'fare', header: 'Fare', render: (row) => <span style={{ fontWeight: 700 }}>{Number(row.fare || 0).toLocaleString()} FCFA</span> },
    { key: 'trip_status', header: 'Status', render: (row) => <Badge>{row.trip_status}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Trips" subtitle={`${trips.length} trip${trips.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={fetchTrips} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <IconRefresh size={16} /> Refresh
          </button>
        } />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', backgroundColor: filter === f.value ? C.primaryFaint : 'transparent', border: `1px solid ${filter === f.value ? C.primary : C.borderStrong}`, color: filter === f.value ? C.primary : C.textMuted }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} />
            <style>{`@keyframes kivospin { from { transform: rotate(0deg);} to {transform: rotate(360deg);} }`}</style>
          </div>
        ) : (
          <DataTable columns={columns} rows={trips} onRowClick={(row) => router.push(`/trips/${row.id}`)} emptyText="No trips found." />
        )}
      </div>
    </div>
  );
}
