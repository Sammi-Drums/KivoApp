'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import { IconRefresh, IconLoader2 } from '@tabler/icons-react';

export default function PayoutsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payouts')
      .select('id, amount, payout_status, processed_at, driver:drivers(full_name)')
      .order('processed_at', { ascending: false, nullsFirst: true }).limit(100);
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { key: 'driver', header: 'Driver', render: (r) => r.driver?.full_name || '—' },
    { key: 'amount', header: 'Amount', render: (r) => <span style={{ fontWeight: 700 }}>{Number(r.amount).toLocaleString()} FCFA</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge color={r.payout_status === 'processed' ? C.primary : r.payout_status === 'failed' ? C.danger : C.warn}>{r.payout_status}</Badge> },
    { key: 'processed', header: 'Processed', render: (r) => r.processed_at ? new Date(r.processed_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
  ];

  return (
    <div>
      <PageHeader title="Payouts" subtitle={`${rows.length} payout${rows.length !== 1 ? 's' : ''}`}
        actions={<button onClick={fetch} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><IconRefresh size={16} /> Refresh</button>} />
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8 }}>
        {loading ? <L /> : <DataTable columns={columns} rows={rows} emptyText="No payouts yet." />}
      </div>
    </div>
  );
}
function L() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} /><style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style></div>; }
