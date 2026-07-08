import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Container } from "./Container";
import { UserMenu } from "./UserMenu";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/destinations", label: "Destinations" },
  { to: "/flights", label: "Flights" },
  { to: "/hotels", label: "Hotels" },
  { to: "/experiences", label: "Experiences" },
  { to: "/studio", label: "Studio" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-500",
        scrolled
          ? "glass border-b border-border/60 text-foreground"
          : "bg-transparent border-b border-transparent text-white",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-ink via-brand-navy to-brand-teal shadow-lg ring-1 ring-white/15">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand-sunrise" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 14c3-8 11-8 14 0" />
              <circle cx="10" cy="7" r="1.5" fill="currentColor" />
            </svg>
          </span>
          <span className="font-display text-2xl leading-none tracking-[-0.02em]">Easy Trip</span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3.5 py-1.5 text-sm text-white/75 transition-colors hover:text-white"
              activeProps={{ className: "text-white bg-white/10" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            to="/studio"
            className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-brand-ink transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Open Studio <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <UserMenu />
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-white/10"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      {open && (
        <div className="lg:hidden border-t border-white/10 bg-brand-ink/95 backdrop-blur">
          <Container className="py-3 flex flex-col">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="px-2 py-3 text-base text-white/80 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              <Link to="/auth" onClick={() => setOpen(false)} className="flex-1 rounded-full border border-white/20 px-4 py-2 text-center text-sm text-white">Sign in</Link>
              <Link to="/studio" onClick={() => setOpen(false)} className="flex-1 rounded-full bg-white px-4 py-2 text-center text-sm text-brand-ink">Open Studio</Link>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
