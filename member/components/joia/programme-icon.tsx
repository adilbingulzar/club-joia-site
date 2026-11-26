import {
  BedDouble, Camera, CarFront, Coffee, DoorOpen, Fish, Flag, Gauge, Gift, Handshake, Info, Martini,
  Music, PartyPopper, Plane, Sailboat, Star, Trophy, UtensilsCrossed, type LucideIcon,
} from "lucide-react";
import { resolveProgrammeIcon, type ProgrammeIconKey } from "@/member/domain/programme-icons";
import { cn } from "@/member/lib/utils";

export const PROGRAMME_ICON_GLYPHS: Record<ProgrammeIconKey, LucideIcon> = {
  arrival: DoorOpen,
  champagne: Martini,
  dining: UtensilsCrossed,
  seafood: Fish,
  coffee: Coffee,
  yacht: Sailboat,
  race: Flag,
  track: Gauge,
  trophy: Trophy,
  music: Music,
  party: PartyPopper,
  networking: Handshake,
  transport: CarFront,
  flight: Plane,
  hotel: BedDouble,
  photo: Camera,
  gift: Gift,
  star: Star,
  info: Info,
};

/** Topic icon tile shown on the right of a programme card. Decorative: the title carries the meaning. */
export function ProgrammeIcon({
  item,
  color,
  size = "md",
  className,
}: {
  item: { icon?: string | null; title: string; subtitle?: string | null; category: string };
  color: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const Glyph = PROGRAMME_ICON_GLYPHS[resolveProgrammeIcon(item)];
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-xl border", { xs: "size-8 rounded-lg", sm: "size-10", md: "size-12" }[size], className)}
      style={{ color, borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <Glyph className={{ xs: "size-4", sm: "size-[18px]", md: "size-[22px]" }[size]} strokeWidth={1.5} />
    </span>
  );
}
