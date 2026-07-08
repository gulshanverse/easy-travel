import { cn } from "@/lib/utils";

/**
 * Easy Trip — brand identity.
 *
 * The mark is a single continuous stroke that reads as:
 *   · a horizon line rising into flight,
 *   · a compass arc,
 *   · and the letter "E" hidden in the negative space.
 * A small solid dot anchors the composition — the traveller,
 * the pin on the map, the "you are here."
 *
 * Designed to remain legible at 16px and expressive at 512px.
 */
export function LogoMark({
  className,
  title = "Easy Trip",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="et-mark-stroke" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--brand-sunrise)" />
          <stop offset="60%" stopColor="var(--brand-coral)" />
          <stop offset="100%" stopColor="var(--brand-teal)" />
        </linearGradient>
        <linearGradient id="et-mark-bg" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--brand-ink)" />
          <stop offset="100%" stopColor="var(--brand-navy)" />
        </linearGradient>
      </defs>

      {/* Rounded square medallion — the sky at dusk */}
      <rect x="0" y="0" width="32" height="32" rx="9" fill="url(#et-mark-bg)" />

      {/* The horizon arc — rising flight path.
          Starts low-left, sweeps up-right, becomes an ascending trail. */}
      <path
        d="M6 21 Q 12 21 15.5 17 T 25 8"
        stroke="url(#et-mark-stroke)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Traveller dot — the pin, the here-and-now */}
      <circle cx="25" cy="8" r="2.1" fill="var(--brand-sunrise)" />

      {/* Sub-hairline — an "E" hint via three horizontals */}
      <path
        d="M6 25 H 15"
        stroke="url(#et-mark-stroke)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Full wordmark: mark + Fraunces "Easy Trip" set with the same
 * optical weight the mark implies. Use in navigation and footers.
 */
export function Logo({
  className,
  showWordmark = true,
  tone = "auto",
}: {
  className?: string;
  showWordmark?: boolean;
  tone?: "auto" | "light" | "dark";
}) {
  const wordClass =
    tone === "light"
      ? "text-white"
      : tone === "dark"
        ? "text-brand-ink"
        : "text-foreground";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8" />
      {showWordmark && (
        <span className={cn("font-display text-[1.35rem] leading-none tracking-[-0.025em]", wordClass)}>
          Easy <span className="font-editorial">Trip</span>
        </span>
      )}
    </span>
  );
}
