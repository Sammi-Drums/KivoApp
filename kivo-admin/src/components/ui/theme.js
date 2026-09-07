// Shared color tokens — import anywhere for consistent styling
export const C = {
  bg: '#0D1829',
  surface: '#152133',
  surface2: '#1B2942',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.12)',
  text: '#EDF2FF',
  textMuted: '#8896AE',
  textFaint: '#3E5170',
  primary: '#00D46A',
  primaryFaint: 'rgba(0,212,106,0.12)',
  danger: '#FF4757',
  dangerFaint: 'rgba(255,71,87,0.12)',
  warn: '#FFB800',
  warnFaint: 'rgba(255,184,0,0.12)',
  info: '#2196F3',
  infoFaint: 'rgba(33,150,243,0.12)',
};

// Status → color mapping used across pages
export const STATUS_COLOR = {
  // approval
  pending: C.warn, approved: C.primary, rejected: C.danger,
  // driver_status
  active: C.primary, inactive: C.textMuted, suspended: C.danger,
  // trip_status
  requested: C.warn, accepted: C.info, ongoing: C.info,
  completed: C.primary, cancelled: C.danger,
};
