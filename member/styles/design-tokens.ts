/**
 * CLUB JOIA 300 design tokens — the canonical values.
 * `src/app/globals.css` mirrors these as CSS custom properties / Tailwind theme tokens;
 * change both together. Components use Tailwind classes generated from those tokens
 * (e.g. `bg-ink`, `text-pearl`, `text-ruby`) rather than raw values.
 */

export const colors = {
  ink: "#050505", // primary black
  ultra: "#0B0B0C", // ultra black — matte surfaces
  surface: "#111113",
  surfaceRaised: "#18181B",
  line: "rgba(245, 243, 238, 0.10)",

  pearl: "#F5F3EE", // pearl white
  pearlMuted: "#BDB9B0",
  pearlDim: "#8F8B82",
  paper: "#FBFAF7", // admin canvas

  ruby: "#EF233C", // JOIA accent red
  rubyDeep: "#A3101F",
  rubyInk: "#5A0611",

  silver: "#C9CCD1", // metallic silver — card details only
  silverDark: "#8E9299",

  success: "#22A06B",
  warning: "#E8A23A",
  danger: "#E5383B",
} as const;

export const scanColors = {
  success: { bg: "#0E7A4F", fg: "#FFFFFF" },
  warning: { bg: "#B97500", fg: "#FFFFFF" },
  danger: { bg: "#B3121F", fg: "#FFFFFF" },
} as const;

export const fonts = {
  display: "var(--font-display)", // editorial serif — hero & display moments
  sans: "var(--font-sans)", // UI & data
} as const;

export const radius = { sm: "6px", md: "12px", lg: "20px", card: "18px", pill: "999px" } as const;

export const spacing = { gutter: "20px", section: "40px" } as const;

export const shadows = {
  card: "0 30px 60px -20px rgba(0,0,0,0.65), 0 18px 36px -18px rgba(0,0,0,0.6)",
  soft: "0 10px 30px -12px rgba(0,0,0,0.45)",
} as const;

/** Metallic finishes for the membership card, keyed by MembershipTier.cardTheme. */
export const cardThemes = {
  ruby: {
    label: "Ruby Red",
    base: "linear-gradient(135deg, #3A0309 0%, #8E0E1E 28%, #D11B32 52%, #7A0A18 74%, #2A0206 100%)",
    sheen: "linear-gradient(115deg, transparent 30%, rgba(255,214,220,0.22) 47%, rgba(255,255,255,0.05) 53%, transparent 70%)",
    text: "#FDF1F2",
    subtle: "rgba(253,241,242,0.68)",
    edge: "rgba(255,190,198,0.35)",
  },
  pearl: {
    label: "Pearly White",
    base: "linear-gradient(135deg, #E9E5DC 0%, #FBFAF6 25%, #E4E7EC 48%, #F7EFE9 68%, #D9D5CC 100%)",
    sheen: "linear-gradient(115deg, transparent 30%, rgba(214,226,255,0.45) 46%, rgba(255,230,240,0.35) 52%, transparent 70%)",
    text: "#141414",
    subtle: "rgba(20,20,20,0.6)",
    edge: "rgba(255,255,255,0.8)",
  },
  black: {
    label: "Ultra Black",
    base: "linear-gradient(135deg, #050505 0%, #151517 35%, #0A0A0B 60%, #1B1B1E 82%, #060606 100%)",
    sheen: "linear-gradient(115deg, transparent 32%, rgba(201,204,209,0.16) 47%, rgba(255,255,255,0.04) 53%, transparent 68%)",
    text: "#EDEDED",
    subtle: "rgba(237,237,237,0.58)",
    edge: "rgba(201,204,209,0.28)",
  },
} as const;

export type CardTheme = keyof typeof cardThemes;

export function cardTheme(theme: string | null | undefined): (typeof cardThemes)[CardTheme] {
  return cardThemes[(theme as CardTheme) in cardThemes ? (theme as CardTheme) : "ruby"];
}

/** Programme category → accent used on the timeline dot and label. */
export const categoryStyles: Record<string, { label: string; color: string }> = {
  ARRIVAL: { label: "Arrival", color: "#C9CCD1" },
  HOSPITALITY: { label: "Hospitality", color: "#E9D8A6" },
  RACING: { label: "Racing", color: "#EF233C" },
  FOOD: { label: "Dining", color: "#D9A87E" },
  ENTERTAINMENT: { label: "Entertainment", color: "#B49FDC" },
  NETWORKING: { label: "Networking", color: "#8FC1D4" },
  CONCIERGE: { label: "Concierge", color: "#9FD4B5" },
  AFTER_PARTY: { label: "After party", color: "#F28DA0" },
  OTHER: { label: "Other", color: "#8F8B82" },
};

export const themeColor = colors.ink;
