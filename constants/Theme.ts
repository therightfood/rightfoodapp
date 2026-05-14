// constants/Theme.ts

export const COLORS = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceSecondary: '#F2F0EB',
  surfaceTertiary: '#EAE8E2',
  text: '#1A1A1A',
  textSecondary: '#7A6A5A',
  textTertiary: '#B0A090',
  primary: '#4A7C59',
  primaryMuted: 'rgba(74, 124, 89, 0.10)',
  primaryLight: 'rgba(74, 124, 89, 0.06)',
  accent: '#C8933A',
  accentMuted: 'rgba(200, 147, 58, 0.10)',
  danger: '#C0392B',
  dangerMuted: 'rgba(192, 57, 43, 0.08)',
  border: '#E8E6E0',
  divider: 'rgba(26, 26, 26, 0.06)',
};

export const TYPE = {
  display: {
    fontSize: 52,
    fontWeight: '700' as const,
    letterSpacing: -1,
    color: COLORS.text,
  },
  hero: {
    fontSize: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: COLORS.text,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    color: COLORS.text,
  },
  heading: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    color: COLORS.text,
  },
  bodySmall: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: COLORS.text,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: COLORS.textSecondary,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase' as const,
    color: COLORS.textSecondary,
  },
  tabular: {
    fontVariant: ['tabular-nums'] as any,
  },
};

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};
