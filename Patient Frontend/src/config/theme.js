// My Dentist PK — shared color theme.
// Single source of truth for the app palette so screens stay cohesive.
export const colors = {
  // Brand blues
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryAlt: '#0052FF',
  primarySoft: '#DBEAFE',
  primaryTint: '#EFF6FF',

  // Neutrals
  ink: '#0A1551',
  text: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
  bg: '#F4F7FE',
  card: '#FFFFFF',

  // Status / accents
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  gold: '#F59E0B',
  purple: '#8B5CF6',
  purpleSoft: '#EDE9FE',
};

// Gradient pairs for cards / headers.
export const gradients = {
  blue: ['#3B82F6', '#1E40AF'],
  green: ['#34D399', '#16A34A'],
  amber: ['#FBBF24', '#D97706'],
  purple: ['#A78BFA', '#8B5CF6'],
};

export default colors;
