import { C } from './theme';

const COLORS = [C.primary, C.info, C.warn, C.danger, '#7F77DD'];

export default function Avatar({ name = '', size = 36 }) {
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: color, color: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.36, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
