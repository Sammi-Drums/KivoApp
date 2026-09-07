'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  IconLayoutDashboard, IconCar, IconUsers, IconSteeringWheel,
  IconCoin, IconReceipt, IconCash, IconMapPin, IconTag,
  IconShield, IconSettings, IconLogout,
} from '@tabler/icons-react';

const C = {
  bg: '#0D1829', surface: '#152133', border: 'rgba(255,255,255,0.08)',
  text: '#EDF2FF', textMuted: '#8896AE', primary: '#00D46A',
  primaryFaint: 'rgba(0,212,106,0.12)', danger: '#FF4757',
};

const NAV = [
  { section: 'MAIN', items: [
    { href: '/', label: 'Dashboard', icon: IconLayoutDashboard },
    { href: '/trips', label: 'Trips', icon: IconCar },
    { href: '/passengers', label: 'Passengers', icon: IconUsers },
    { href: '/drivers', label: 'Drivers', icon: IconSteeringWheel },
  ]},
  { section: 'FINANCE', items: [
    { href: '/revenue', label: 'Revenue', icon: IconCoin },
    { href: '/transactions', label: 'Transactions', icon: IconReceipt },
    { href: '/payouts', label: 'Payouts', icon: IconCash },
  ]},
  { section: 'CONFIGURATION', items: [
    { href: '/zones', label: 'Zones', icon: IconMapPin },
    { href: '/promos', label: 'Promos', icon: IconTag },
    { href: '/team', label: 'Admin Team', icon: IconShield },
    { href: '/settings', label: 'Settings', icon: IconSettings },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    async function loadAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('admins')
        .select('full_name, position')
        .eq('user_id', user.id)
        .maybeSingle();
      setAdmin({ ...data, email: user.email });
    }
    loadAdmin();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside style={{
      width: 260, minWidth: 260, height: '100vh', backgroundColor: C.bg,
      borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary, color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14,
        }}>KR</div>
        <span style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
          Kivo <span style={{ color: C.primary }}>Rides</span>
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {NAV.map((group) => (
          <div key={group.section} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.textMuted, padding: '0 12px', marginBottom: 8 }}>
              {group.section}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 10, marginBottom: 2, textDecoration: 'none',
                    backgroundColor: active ? C.primaryFaint : 'transparent',
                    color: active ? C.primary : C.textMuted,
                    fontSize: 14, fontWeight: active ? 700 : 500,
                    transition: 'background-color 0.15s',
                  }}>
                  <Icon size={20} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + signout */}
      <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', backgroundColor: C.primary, color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13,
          }}>
            {admin?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2) || 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {admin?.full_name || 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {admin?.position || 'Administrator'}
            </div>
          </div>
        </div>
        <button onClick={handleSignOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.25)',
            color: C.danger, borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
          <IconLogout size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
