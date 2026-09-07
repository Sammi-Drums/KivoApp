'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import { IconRefresh, IconLoader2 } from '@tabler/icons-react';

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('id, transaction_type, amount, reference, created_at, wallet:wallets(user:users(username, email))')
      .order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { key: 'ref', header: 'Reference', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.textMuted }}>{r.reference || r.id.slice(0, 8)}</span> },
    { key: 'user', header: 'User', render: (r) => r.wallet?.user?.email || r.wallet?.user?.username || '—' },
    { key: 'type', header: 'Type', render: (r) => <Badge color={r.transaction_type === 'credit' ? C.primary : C.danger}>{r.transaction_type}</Badge> },
    { key: 'amount', header: 'Amount', render: (r) => <span style={{ fontWeight: 700, color: r.transaction_type === 'credit' ? C.primary : C.danger }}>{r.transaction_type === 'credit' ? '+' : '-'}{Number(r.amount).toLocaleString()} FCFA</span> },
    { key: 'created_at', header: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) },
  ];

  return (
    <div>
      <PageHeader title="Transactions" subtitle={`${rows.length} transaction${rows.length !== 1 ? 's' : ''}`}
        actions={<button onClick={fetch} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'transparent', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><IconRefresh size={16} /> Refresh</button>} />
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8 }}>
        {loading ? <L /> : <DataTable columns={columns} rows={rows} emptyText="No transactions yet." />}
      </div>
    </div>
  );
}
function L() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} /><style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style></div>; }
