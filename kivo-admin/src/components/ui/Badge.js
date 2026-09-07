import { C, STATUS_COLOR } from './theme';

export default function Badge({ children, color }) {
  const bg = color || STATUS_COLOR[children] || C.textMuted;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11, fontWeight: 700,
      padding: '4px 10px', borderRadius: 8,
      color: bg, backgroundColor: `${bg}22`,
      textTransform: 'capitalize',
    }}>
      {children}
    </span>
  );
}
