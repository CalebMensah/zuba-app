// constants/colors.ts
export const Colors = {
  // Primary Brand Colors - Updated to lighter blue
  primary: '#3B82F6', // Bright blue (previously primaryLight) #3B82F6
  primaryLight: '#60A5FA', // Even lighter blue
  primaryDark: '#2563EB', // Darker blue
  
  // Accent Colors
  accent: '#EF4444', // Red accent (from logo)
  accentLight: '#F87171',
  accentDark: '#DC2626',
  
  // Success/Green (cart icon)
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#059669',
  
  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  
  // Grays
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Text Colors
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textLight: '#FFFFFF',
  
  // Background Colors - Updated with softer backgrounds
  background: '#F5F7FA', // Soft light blue-gray
  backgroundSecondary: '#F9FAFB',
  backgroundTertiary: '#F3F4F6',
  
  // Border Colors
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderDark: '#D1D5DB',
  
  // Status Colors
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.25)',
  
  // Disabled
  disabled: '#D1D5DB',
  disabledText: '#9CA3AF',
};

// Typography - Modern, Professional Font Families
// Note: Make sure to load these fonts in your app using expo-font or similar
export const Typography = {
  // Font Families
  regular: 'Inter-Regular', // Clean, modern sans-serif
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extraBold: 'Inter-ExtraBold',
  
  // Alternative: If Inter is not available, use system fonts
  // regular: 'System',
  // medium: 'System',
  // semiBold: 'System',
  // bold: 'System',
  // extraBold: 'System',
  
  // Font Sizes
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
};

// If you want to use system default fonts without importing custom fonts:
export const SystemTypography = {
  regular: undefined, // Uses system default
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
};