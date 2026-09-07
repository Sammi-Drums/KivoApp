'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import {
  IconArrowLeft, IconCheck, IconX, IconBan, IconRefresh,
  IconPhone, IconMail, IconMapPin, IconId, IconCar, IconLoader2,
} from '@tabler/icons-react';

export default function DriverDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [driver, setDriver] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDriver = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('*, city:cities(city_name)')
      .eq('id', params.id)
      .maybeSingle();
    setDriver(data);

    const { data: vData } = await supabase
      .from('vehicles').select('*').eq('driver_id', params.id);
    setVehicles(vData || []);
    setLoading(false);
  };

  useEffect(() => { fetchDriver(); }, [params.id]);

  // Decide which action buttons to show.
  // Approval status wins: pending drivers get Approve/Reject regardless of driver_status.
  const getActions = () => {
    if (!driver) return [];
    if (driver.approval_status === 'pending') return ['approve', 'reject'];
    if (driver.approval_status === 'rejected') return ['approve'];
    if (driver.approval_status === 'approved') {
      if (driver.driver_status === 'suspended') return ['reactivate'];
      return ['suspend'];
    }
    return [];
  };

  const runAction = async (action) => {
    setActionLoading(true);
    setError('');

    const updates = {};
    if (action === 'approve') { updates.approval_status = 'approved'; updates.driver_status = 'active'; }
    if (action === 'reject') { updates.approval_status = 'rejected'; updates.driver_status = 'inactive'; }
    if (action === 'suspend') { updates.driver_status = 'suspended'; }
    if (action === 'reactivate') { updates.driver_status = 'active'; }

    const { error: updateError } = await supabase
      .from('drivers').update(updates).eq('id', params.id);

    if (updateError) {
      setError(updateError.message);
      setActionLoading(false);
      return;
    }

    await fetchDriver();
    setActionLoading(false);
  };

  const ACTION_CONFIG = {
    approve: { label: 'Approve Driver', icon: IconCheck, bg: C.primary, color: '#000' },
    reject: { label: 'Reject Driver', icon: IconX, bg: C.dangerFaint, color: C.danger, border: true },
    suspend: { label: 'Suspend Driver', icon: IconBan, bg: C.dangerFaint, color: C.danger, border: true },
    reactivate: { label: 'Activate Driver', icon: IconRefresh, bg: C.primary, color: '#000' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} />
        <style>{`@keyframes kivospin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!driver) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: C.danger, marginBottom: 16 }}>Driver not found</p>
        <button onClick={() => router.push('/drivers')}
          style={{ backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>
          Back to Drivers
        </button>
      </div>
    );
  }

  const actions = getActions();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: '0 0 4px 0' }}>{driver.full_name}</h1>
          <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>
            Driver profile · {driver.onboarding_method === 'admin_created' ? 'Created by admin' : 'Self-registered'}
          </p>
        </div>
        <button onClick={() => router.push('/drivers')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <IconArrowLeft size={16} /> Back to Drivers
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: C.dangerFaint, border: `1px solid rgba(255,71,87,0.25)`, color: C.danger, fontSize: 14, padding: '12px 16px', borderRadius: 10, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 20 }}>
        {/* LEFT: profile + vehicle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Profile card */}
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <Avatar name={driver.full_name} size={64} />
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: '0 0 6px 0' }}>{driver.full_name}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge>{driver.driver_status}</Badge>
                  <Badge>{driver.approval_status}</Badge>
                  <Badge color={C.info}>{driver.driver_category || 'economy'}</Badge>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <InfoRow icon={<IconPhone size={16} />} label="Phone" value={driver.phone_number} />
              <InfoRow icon={<IconMail size={16} />} label="Email" value={driver.email} />
              <InfoRow icon={<IconMapPin size={16} />} label="City" value={driver.city?.city_name} />
              <InfoRow icon={<IconId size={16} />} label="License No." value={driver.driver_license_no} />
            </div>
          </div>

          {/* Vehicles card */}
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCar size={18} color={C.primary} /> Vehicles
            </h3>
            {vehicles.length > 0 ? (
              vehicles.map((v) => (
                <div key={v.id} style={{ backgroundColor: C.bg, borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: C.text }}>{[v.brand, v.model, v.year].filter(Boolean).join(' ') || v.vehicle_type}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Plate: <span style={{ fontFamily: 'monospace' }}>{v.plate_number}</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Badge color={C.info}>{v.vehicle_type}</Badge>
                    <Badge>{v.vehicle_status}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: C.textMuted, fontSize: 14 }}>No vehicles registered</p>
            )}
          </div>
        </div>

        {/* RIGHT: actions */}
        <div>
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 16px 0' }}>Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {actions.length === 0 ? (
                <p style={{ color: C.textMuted, fontSize: 14, textAlign: 'center', padding: '8px 0' }}>No actions available</p>
              ) : (
                actions.map((action) => {
                  const cfg = ACTION_CONFIG[action];
                  const Icon = cfg.icon;
                  return (
                    <button key={action} onClick={() => runAction(action)} disabled={actionLoading}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        backgroundColor: cfg.bg, color: cfg.color,
                        border: cfg.border ? `1px solid rgba(255,71,87,0.25)` : 'none',
                        borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700,
                        cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1,
                      }}>
                      {actionLoading ? <IconLoader2 size={16} style={{ animation: 'kivospin 0.8s linear infinite' }} /> : <Icon size={16} />}
                      {cfg.label}
                    </button>
                  );
                })
              )}
            </div>
            <style>{`@keyframes kivospin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, display: 'flex', gap: 10 }}>
      <div style={{ color: C.textFaint, marginTop: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, color: C.textFaint }}>{label}</div>
        <div style={{ fontSize: 14, color: C.text, marginTop: 2 }}>{value || '—'}</div>
      </div>
    </div>
  );
}
