import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Container } from "./Container";
import { UserMenu } from "./UserMenu";
import { Logo } from "@/components/brand/Logo";
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
        "sticky top-0 z-50 w-full text-foreground transition-all duration-500",
        scrolled
          ? "glass border-b border-border/60"
          : "glass border-b border-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link to="/" aria-label="Easy Trip — home" className="group inline-flex items-center">
          <Logo className="transition-transform duration-500 group-hover:-translate-y-0.5" />
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3.5 py-1.5 text-sm text-foreground/70 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground bg-muted" }}
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
          className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      {open && (
        <div className="lg:hidden border-t border-border/60 glass">
          <Container className="py-3 flex flex-col">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="px-2 py-3 text-base text-foreground/80 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              <Link to="/auth" onClick={() => setOpen(false)} className="flex-1 rounded-full border border-border px-4 py-2 text-center text-sm text-foreground">Sign in</Link>
              <Link to="/studio" onClick={() => setOpen(false)} className="flex-1 rounded-full bg-brand-ink px-4 py-2 text-center text-sm text-white">Open Studio</Link>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
