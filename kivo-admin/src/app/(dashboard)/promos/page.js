'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import DataTable from '@/components/ui/DataTable';
import { IconPlus, IconLoader2, IconX } from '@tabler/icons-react';

export default function PromosPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ promo_code: '', discount_type: 'percentage', discount_value: '', start_date: '', end_date: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('promotions').select('*').order('start_date', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    setError('');
    if (!form.promo_code || !form.discount_value || !form.start_date || !form.end_date) {
      setError('Fill in code, value, and dates.');
      return;
    }
    setSaving(true);
    const { error: e } = await supabase.from('promotions').insert({
      promo_code: form.promo_code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      start_date: form.start_date,
      end_date: form.end_date,
      description: form.description || null,
      status: 'active',
    });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setShowForm(false);
    setForm({ promo_code: '', discount_type: 'percentage', discount_value: '', start_date: '', end_date: '', description: '' });
    fetch();
  };

  const columns = [
    { key: 'promo_code', header: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontWeight: 800, color: C.primary }}>{r.promo_code}</span> },
    { key: 'discount', header: 'Discount', render: (r) => <span style={{ fontWeight: 700 }}>{r.discount_type === 'percentage' ? `${r.discount_value}%` : `${Number(r.discount_value).toLocaleString()} FCFA`}</span> },
    { key: 'period', header: 'Valid', render: (r) => <span style={{ fontSize: 12, color: C.textMuted }}>{r.start_date} → {r.end_date}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge color={r.status === 'active' ? C.primary : C.textMuted}>{r.status}</Badge> },
  ];

  const inp = { width: '100%', boxSizing: 'border-box', backgroundColor: C.bg, border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: '11px 13px', color: C.text, fontSize: 14, outline: 'none' };
  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6, letterSpacing: 0.3 };

  return (
    <div>
      <PageHeader title="Promo Codes" subtitle={`${rows.length} promotion${rows.length !== 1 ? 's' : ''}`}
        actions={<button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: C.primary, color: '#000', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}><IconPlus size={16} /> New Code</button>} />

      {showForm && (
        <div style={{ backgroundColor: C.surface, border: `1px solid ${C.primary}44`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Create Promo Code</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer' }}><IconX size={20} /></button>
          </div>
          {error && <div style={{ backgroundColor: C.dangerFaint, color: C.danger, fontSize: 13, padding: 10, borderRadius: 8, marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div><label style={lbl}>CODE</label><input style={inp} value={form.promo_code} onChange={e => setForm({ ...form, promo_code: e.target.value.toUpperCase() })} placeholder="WELCOME50" /></div>
            <div><label style={lbl}>TYPE</label><select style={inp} value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed (FCFA)</option></select></div>
            <div><label style={lbl}>VALUE</label><input style={inp} type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} placeholder="50" /></div>
            <div><label style={lbl}>START DATE</label><input style={inp} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label style={lbl}>END DATE</label><input style={inp} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>DESCRIPTION</label><input style={inp} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="50% off your first ride" /></div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ marginTop: 16, backgroundColor: C.primary, color: '#000', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? <IconLoader2 size={16} style={{ animation: 'kivospin 0.8s linear infinite' }} /> : null} Create Code
            <style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </button>
        </div>
      )}

      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8 }}>
        {loading ? <L /> : <DataTable columns={columns} rows={rows} emptyText="No promo codes yet. Create one above." />}
      </div>
    </div>
  );
}
function L() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} /><style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style></div>; }
