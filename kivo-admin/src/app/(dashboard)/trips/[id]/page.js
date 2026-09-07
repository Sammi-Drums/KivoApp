'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import Badge from '@/components/ui/Badge';
import { IconArrowLeft, IconLoader2 } from '@tabler/icons-react';

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [trip, setTrip] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trips')
        .select('*, passenger:passengers(full_name), driver:drivers(full_name, phone_number), vehicle:vehicles(vehicle_type, plate_number, color)')
        .eq('id', params.id).maybeSingle();
      setTrip(data);
      const { data: pay } = await supabase.from('payments').select('*').eq('trip_id', params.id).maybeSingle();
      setPayment(pay);
      setLoading(false);
    }
    load();
  }, [params.id]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} />
      <style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>;
  }
  if (!trip) return <div style={{ textAlign: 'center', padding: 60, color: C.danger }}>Trip not found</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: '0 0 4px 0', fontFamily: 'monospace' }}>{trip.trip_code}</h1>
          <Badge>{trip.trip_status}</Badge>
        </div>
        <button onClick={() => router.push('/trips')} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <IconArrowLeft size={16} /> Back
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        <Card title="Route">
          <Row label="Pickup" value={trip.pickup_location} />
          <Row label="Drop-off" value={trip.dropoff_location} />
          <Row label="Distance" value={trip.distance_km ? `${trip.distance_km} km` : '—'} />
          <Row label="Duration" value={trip.duration_minutes ? `${trip.duration_minutes} min` : '—'} />
          <Row label="Ride tier" value={trip.ride_tier || trip.ride_type || '—'} />
        </Card>

        <Card title="People">
          <Row label="Passenger" value={trip.passenger?.full_name} />
          <Row label="Driver" value={trip.driver?.full_name || 'Unassigned'} />
          <Row label="Driver phone" value={trip.driver?.phone_number} />
          <Row label="Vehicle" value={trip.vehicle ? `${trip.vehicle.vehicle_type} · ${trip.vehicle.plate_number}` : '—'} />
        </Card>

        <Card title="Payment">
          <Row label="Fare" value={`${Number(trip.fare || 0).toLocaleString()} FCFA`} highlight />
          {trip.discount_amount > 0 && <Row label="Discount" value={`-${Number(trip.discount_amount).toLocaleString()} FCFA`} />}
          <Row label="Method" value={payment?.payment_method || '—'} />
          <Row label="Payment status" value={payment?.payment_status || '—'} />
          <Row label="Driver earnings (85%)" value={trip.trip_status === 'completed' ? `${Math.round(Number(trip.fare || 0) * 0.85).toLocaleString()} FCFA` : '—'} />
        </Card>

        <Card title="Timeline">
          <Row label="Requested" value={fmt(trip.created_at)} />
          <Row label="Accepted" value={fmt(trip.accepted_at)} />
          <Row label="Started" value={fmt(trip.started_at)} />
          <Row label="Completed" value={fmt(trip.completed_at)} />
          <Row label="Cancelled" value={fmt(trip.cancelled_at)} />
        </Card>
      </div>
    </div>
  );
}

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function Card({ title, children }) {
  return (
    <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px 0' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}
function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: highlight ? 800 : 500, color: highlight ? C.primary : C.text, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}
