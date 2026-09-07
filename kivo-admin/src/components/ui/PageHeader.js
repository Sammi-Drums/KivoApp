import { C } from './theme';

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: 24, gap: 16, flexWrap: 'wrap',
    }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: '0 0 4px 0' }}>{title}</h1>
        {subtitle && <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10 }}>{actions}</div>}
    </div>
  );
}
