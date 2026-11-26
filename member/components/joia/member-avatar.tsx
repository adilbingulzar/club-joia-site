import { cn, initials } from "@/member/lib/utils";

/** Member photo (served through the authorised file route) with an initials fallback. */
export function MemberAvatar({
  firstName,
  lastName,
  photoUrl,
  size = 40,
  className,
}: {
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const label = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Member";
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised ring-1 ring-line", className)}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated file route; not optimisable
        <img src={photoUrl} alt={label} className="size-full object-cover" />
      ) : (
        <span aria-label={label} role="img" className="font-display text-pearl" style={{ fontSize: size * 0.4 }}>
          {initials(firstName, lastName)}
        </span>
      )}
    </span>
  );
}
