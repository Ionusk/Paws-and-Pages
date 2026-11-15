// Shared Paws & Pages palette. Values match the colors already used across
// the screens, so new shared components look identical to the existing UI.

export const PALETTE = {
  background: '#E9DDF2',
  white: '#FFFFFF',
  text: '#493653',
  muted: '#806B87',
  pink: '#F6C8D4',
  darkPink: '#B77D88',
  lightPink: '#FFF0F2',
  lavender: '#F5ECFA',
  purple: '#9B829F',
  sage: '#DCE6D8',
  sageDark: '#71866F',
  peach: '#F7E1D5',
  border: '#E7D9EE',
  danger: '#B44B58',
  dangerSoft: '#FCE8EB',
  success: '#5F7F5B',
  successSoft: '#E6F0E3',
} as const;

export const FONT = {
  heading: 'PlayfairDisplay_700Bold',
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtraBold: 'Nunito_800ExtraBold',
} as const;

/** Width under which screens switch to a single-column phone layout. */
export const COMPACT_BREAKPOINT = 640;
