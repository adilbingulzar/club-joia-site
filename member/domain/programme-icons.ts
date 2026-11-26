/**
 * Programme icons. Each programme item shows an icon matching its topic. Admins can pick one
 * explicitly (stored as `event_program_items.icon`); when none is chosen, `resolveProgrammeIcon`
 * picks one from the title / subtitle / location keywords, falling back to the category.
 * Pure — the key → glyph mapping lives in src/components/joia/programme-icon.tsx.
 */

export const PROGRAMME_ICONS = {
  arrival: { label: "Arrival / welcome", keywords: ["arrival", "arrive", "welcome", "doors open", "check in", "check-in"] },
  champagne: { label: "Champagne / drinks", keywords: ["champagne", "drinks", "cocktail", "toast", "aperitif", "sunset", "golden hour", "bar"] },
  dining: { label: "Dining", keywords: ["lunch", "dinner", "brunch", "breakfast", "chef", "menu", "dining", "tasting"] },
  seafood: { label: "Seafood", keywords: ["seafood", "oyster", "sushi"] },
  coffee: { label: "Coffee / tea", keywords: ["coffee", "tea", "espresso"] },
  yacht: { label: "Yacht / boat", keywords: ["yacht", "boat", "cruise", "marina", "on the water"] },
  race: { label: "Race / Grand Prix", keywords: ["grand prix", "race", "lights out", "grid", "qualifying", "pit"] },
  track: { label: "Track / practice", keywords: ["track", "practice", "trackside", "lap", "paddock", "drivers"] },
  trophy: { label: "Podium / trophy", keywords: ["podium", "trophy", "winner", "award"] },
  music: { label: "DJ / music", keywords: ["dj", "music", "live performance", "concert", "band", "entertainment"] },
  party: { label: "Party", keywords: ["party", "after-race", "after race", "afterparty", "after party", "closing"] },
  networking: { label: "Networking", keywords: ["networking", "introductions", "meet", "talk", "panel"] },
  transport: { label: "Transfer / car", keywords: ["transfer", "transport", "car", "chauffeur", "shuttle", "pickup"] },
  flight: { label: "Flight", keywords: ["flight", "jet", "aviation", "helicopter", "airport"] },
  hotel: { label: "Hotel", keywords: ["hotel", "suite", "check-out", "spa"] },
  photo: { label: "Photo / media", keywords: ["photo", "camera", "media", "interview"] },
  gift: { label: "Gift", keywords: ["gift", "goodie", "present"] },
  star: { label: "Highlight", keywords: [] },
  info: { label: "Information", keywords: [] },
} as const;

export type ProgrammeIconKey = keyof typeof PROGRAMME_ICONS;

export const PROGRAMME_ICON_KEYS = Object.keys(PROGRAMME_ICONS) as ProgrammeIconKey[];

const CATEGORY_DEFAULT: Record<string, ProgrammeIconKey> = {
  ARRIVAL: "arrival",
  HOSPITALITY: "champagne",
  RACING: "race",
  FOOD: "dining",
  ENTERTAINMENT: "music",
  NETWORKING: "networking",
  CONCIERGE: "info",
  AFTER_PARTY: "party",
  OTHER: "star",
};

export function isProgrammeIconKey(v: unknown): v is ProgrammeIconKey {
  return typeof v === "string" && Object.hasOwn(PROGRAMME_ICONS, v);
}

/** Order matters: more specific topics are checked before broad ones. */
const MATCH_ORDER: ProgrammeIconKey[] = [
  "seafood", "coffee", "trophy", "party", "yacht", "dining", "race", "track", "champagne",
  "music", "networking", "transport", "flight", "hotel", "photo", "gift", "arrival",
];

export function resolveProgrammeIcon(item: { icon?: string | null; title: string; subtitle?: string | null; category: string }): ProgrammeIconKey {
  if (isProgrammeIconKey(item.icon)) return item.icon;
  const text = [item.title, item.subtitle].filter(Boolean).join(" ").toLowerCase();
  for (const key of MATCH_ORDER) {
    if (PROGRAMME_ICONS[key].keywords.some((k) => hasWord(text, k))) return key;
  }
  return CATEGORY_DEFAULT[item.category] ?? "star";
}

/** Whole-word / whole-phrase match, so "bar" does not match "embark". */
function hasWord(text: string, phrase: string) {
  let i = text.indexOf(phrase);
  while (i !== -1) {
    const before = i === 0 ? "" : text[i - 1];
    const after = text[i + phrase.length] ?? "";
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    i = text.indexOf(phrase, i + 1);
  }
  return false;
}
