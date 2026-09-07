'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  IconCar, IconUsers, IconSteeringWheel, IconCoin,
  IconClock, IconCircleCheck, IconLoader2,
} from '@tabler/icons-react';

const C = {
  bg: '#0D1829', surface: '#152133', border: 'rgba(255,255,255,0.08)',
  text: '#EDF2FF', textMuted: '#8896AE', primary: '#00D46A',
  warn: '#FFB800', info: '#2196F3', danger: '#FF4757',
};

export default function DashboardHome() {
  const [stats, setStats] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      // Run all counts in parallel for speed
      const [
        driversRes, passengersRes, tripsRes, completedRes, pendingDriversRes, recentRes,
      ] = await Promise.all([
        supabase.from('drivers').select('*', { count: 'exact', head: true }),
        supabase.from('passengers').select('*', { count: 'exact', head: true }),
        supabase.from('trips').select('*', { count: 'exact', head: true }),
        supabase.from('trips').select('fare').eq('trip_status', 'completed'),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('trips').select('trip_code, pickup_location, dropoff_location, fare, trip_status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalRevenue = (completedRes.data || []).reduce((sum, t) => sum + Number(t.fare || 0), 0);
      const platformCut = Math.round(totalRevenue * 0.15);

      setStats({
        drivers: driversRes.count || 0,
        passengers: passengersRes.count || 0,
        trips: tripsRes.count || 0,
        completedTrips: (completedRes.data || []).length,
        pendingDrivers: pendingDriversRes.count || 0,
        totalRevenue,
        platformCut,
      });
      setRecentTrips(recentRes.data || []);
      setLoading(false);
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <IconLoader2 size={40} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} />
        <style>{`@keyframes kivospin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const statusColors = {
    requested: C.warn, accepted: C.info, ongoing: C.info,
    completed: C.primary, cancelled: C.danger,
  };

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: '0 0 4px 0' }}>Dashboard</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 28px 0' }}>
        Overview of your platform
      </p>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={IconSteeringWheel} label="Total Drivers" value={stats.drivers} color={C.primary}
          sub={stats.pendingDrivers > 0 ? `${stats.pendingDrivers} pending approval` : 'All reviewed'} />
        <StatCard icon={IconUsers} label="Total Passengers" value={stats.passengers} color={C.info} />
        <StatCard icon={IconCar} label="Total Trips" value={stats.trips} color={C.warn}
          sub={`${stats.completedTrips} completed`} />
        <StatCard icon={IconCoin} label="Platform Revenue" value={`${stats.platformCut.toLocaleString()} FCFA`} color={C.primary}
          sub={`from ${stats.totalRevenue.toLocaleString()} total fares`} />
      </div>

      {/* Recent trips */}
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 16px 0' }}>Recent Trips</h2>
        {recentTrips.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 14 }}>No trips yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentTrips.map((trip, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', backgroundColor: C.bg, borderRadius: 10, gap: 12, flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 2 }}>
                    {trip.trip_code || '—'}
                  </div>
                  <div style={{ fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trip.pickup_location} → {trip.dropoff_location}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                    {Number(trip.fare || 0).toLocaleString()} FCFA
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                    color: statusColors[trip.trip_status] || C.textMuted,
                    backgroundColor: `${statusColors[trip.trip_status] || C.textMuted}22`,
                  }}>
                    {trip.trip_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div style={{ backgroundColor: '#152133', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, backgroundColor: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} color={color} />
        </div>
        <span style={{ fontSize: 13, color: '#8896AE', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#EDF2FF' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#8896AE', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
