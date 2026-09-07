'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/components/ui/theme';
import PageHeader from '@/components/ui/PageHeader';
import { IconDeviceFloppy, IconLoader2, IconCircleCheck } from '@tabler/icons-react';

const LABELS = {
  base_fare: 'Base Fare (FCFA)',
  per_km_rate: 'Per Kilometer (FCFA)',
  per_minute_rate: 'Per Minute (FCFA)',
  minimum_fare: 'Minimum Fare (FCFA)',
  commission_rate: 'Commission Rate (0.15 = 15%)',
  multiplier_shared: 'Shared Multiplier',
  multiplier_moto: 'Moto Multiplier',
  multiplier_economy: 'Economy Multiplier',
  multiplier_comfort: 'Comfort Multiplier',
  multiplier_comfort_plus: 'Comfort+ Multiplier',
  multiplier_business: 'Business Multiplier',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('platform_settings').select('key, value');
      const map = {};
      (data || []).forEach(row => { map[row.key] = row.value; });
      setSettings(map);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('platform_settings').update({ value: String(value), updated_at: new Date().toISOString() }).eq('key', key);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><IconLoader2 size={32} color={C.primary} style={{ animation: 'kivospin 0.8s linear infinite' }} /><style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style></div>;

  const inp = { width: '100%', boxSizing: 'border-box', backgroundColor: C.bg, border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: '11px 13px', color: C.text, fontSize: 14, outline: 'none' };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Pricing and platform configuration"
        actions={
          <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: saved ? C.primary : C.primary, color: '#000', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? <IconLoader2 size={16} style={{ animation: 'kivospin 0.8s linear infinite' }} /> : saved ? <IconCircleCheck size={16} /> : <IconDeviceFloppy size={16} />}
            {saved ? 'Saved!' : 'Save Changes'}
            <style>{`@keyframes kivospin {from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </button>
        } />

      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {Object.keys(LABELS).map((key) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>{LABELS[key]}</label>
              <input style={inp} value={settings[key] ?? ''} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
