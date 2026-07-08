import { useEffect, useState } from "react";

/** True when the visitor prefers reduced motion.
 *  Used to gate heavier decorative motion (cursor glow, bird glide,
 *  passport-stamp draw, sunrise wipe) entirely — not just slow it. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mql.matches);
    on();
    mql.addEventListener?.("change", on);
    return () => mql.removeEventListener?.("change", on);
  }, []);
  return reduced;
}
