import { C } from './theme';

export default function DataTable({ columns, rows, onRowClick, emptyText = 'No data found.' }) {
  if (!rows || rows.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 }}>{emptyText}</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{
                textAlign: 'left', padding: '12px 14px',
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                color: C.textMuted, textTransform: 'uppercase',
                borderBottom: `1px solid ${C.border}`,
              }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                borderBottom: `1px solid ${C.divider || 'rgba(255,255,255,0.05)'}`,
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.backgroundColor = C.surface2; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '14px', fontSize: 14, color: C.text }}>
                  {col.render ? col.render(row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
