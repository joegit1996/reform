export const theme = {
  colors: {
    // Deep, rich gradients and backgrounds
    background: "#090A0F",
    surface: "#12161D",
    surfaceElevated: "#1A202A",
    surfaceHighlighted: "#222B38",

    // Borders & dividers
    border: "#2A3343",
    borderSubtle: "#1C232E",

    // Typography
    textPrimary: "#FFFFFF",
    textSecondary: "#A0ABC0",
    textMuted: "#6B7A90",

    // Core brand accent (Vibrant Neon Orange)
    accent: "#FF6B00",
    accentPressed: "#CC5500",
    accentLight: "rgba(255, 107, 0, 0.15)",

    // Semantic colors
    success: "#00E676",
    successLight: "rgba(0, 230, 118, 0.15)",
    danger: "#FF3B30",
    dangerLight: "rgba(255, 59, 48, 0.15)",
    warning: "#FFCC00",
    info: "#0A84FF",

    // Glass/Translucent overlays
    glassBackground: "rgba(18, 22, 29, 0.75)",
    glassBorder: "rgba(255, 255, 255, 0.08)"
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  },
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    pill: 999
  },
  typography: {
    hero: 42,
    title1: 32,
    title2: 24,
    subtitle: 18,
    body: 16,
    caption: 13,
    tiny: 11
  },
  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10
    },
    glowAcccent: {
      shadowColor: "#FF6B00",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8
    }
  }
} as const;
