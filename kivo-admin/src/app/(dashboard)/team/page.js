'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import Avatar from '@/components/ui/Avatar';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { IconRefresh, IconLoader2 } from '@tabler/icons-react';

export default function TeamPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admins')
      .select('id, full_name, position, created_at, user:users(email, role)')
      .order('created_at', { ascending: true });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { key: 'name', header: 'Admin', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={r.full_name} />
        <div><div style={{ fontWeight: 600 }}>{r.full_name}</div><div style={{ fontSize: 11, color: C.textMuted }}>{r.user?.email || '—'}</div></div>
      </div>
    ) },
    { key: 'position', header: 'Position', render: (r) => r.position || '—' },
    { key: 'role', header: 'Role', render: (r) => <Badge color={r.user?.role === 'super_admin' ? C.primary : C.info}>{r.user?.role || 'admin'}</Badge> },
    { key: 'created_at', header: 'Joined', render: (r) => new Date(r.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) },
  ];

  return (
    <div>
      <PageHeader title="Admin Team" subtitle={`${rows.length} admin${rows.length !== 1 ? 's' : ''}`}
        actions={<button onClick={fetch} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><IconRefresh size={16} /> Refresh</button>} />
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8 }}>
        {loading ? <L /> : <DataTable columns={columns} rows={rows} emptyText="No admins." />}
      </div>
    </div>
  );
}
function L() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} /><style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style></div>; }
