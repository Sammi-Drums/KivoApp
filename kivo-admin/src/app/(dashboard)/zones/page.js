'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import { IconRefresh, IconLoader2 } from '@tabler/icons-react';

export default function ZonesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('operating_zones')
      .select('id, zone_name, status, city:cities(city_name)');
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { key: 'zone_name', header: 'Zone', render: (r) => <span style={{ fontWeight: 600 }}>{r.zone_name}</span> },
    { key: 'city', header: 'City', render: (r) => r.city?.city_name || '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Operating Zones" subtitle={`${rows.length} zone${rows.length !== 1 ? 's' : ''}`}
        actions={<button onClick={fetch} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><IconRefresh size={16} /> Refresh</button>} />
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8 }}>
        {loading ? <L /> : <DataTable columns={columns} rows={rows} emptyText="No zones defined yet." />}
      </div>
    </div>
  );
}
function L() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} /><style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style></div>; }
