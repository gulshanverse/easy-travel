import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Container } from "./Container";

const groups = [
  {
    title: "Explore",
    links: [
      { to: "/destinations", label: "Destinations" },
      { to: "/experiences", label: "Experiences" },
      { to: "/restaurants", label: "Restaurants" },
      { to: "/blog", label: "Travel Journal" },
    ],
  },
  {
    title: "Book",
    links: [
      { to: "/flights", label: "Flights" },
      { to: "/hotels", label: "Hotels" },
      { to: "/trains", label: "Trains" },
      { to: "/buses", label: "Buses" },
      { to: "/cabs", label: "Cabs" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" },
      { to: "/support", label: "Support" },
      { to: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-muted/30">
      <Container className="py-16 grid gap-12 md:grid-cols-6">
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-display text-2xl leading-none">Easy Trip</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Travel smarter with AI. Discover, plan, and book in one intelligent
            interface — grounded in real prices and real reviews.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {g.title}
            </h4>
            <ul className="mt-4 space-y-2.5">
              {g.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <div className="border-t border-border/60">
        <Container className="py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Easy Trip. Travel Smarter with AI.</p>
          <p>Crafted with care for curious travelers.</p>
        </Container>
      </div>
    </footer>
  );
}
