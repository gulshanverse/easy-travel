import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, MapPin, Heart, Ticket, Compass, ArrowRight } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Easy Trip" },
      { name: "description", content: "Your travel command center." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const tiles = [
  { to: "/ai-planner", icon: Sparkles, label: "Plan a trip", desc: "Design a new itinerary with AI." },
  { to: "/my-trips", icon: MapPin, label: "My trips", desc: "Continue where you left off." },
  { to: "/wishlist", icon: Heart, label: "Wishlist", desc: "Places you're dreaming about." },
  { to: "/bookings", icon: Ticket, label: "Bookings", desc: "Flights, stays, and experiences." },
  { to: "/destinations", icon: Compass, label: "Explore", desc: "Discover curated destinations." },
] as const;

function DashboardPage() {
  const { profile, user } = useAuth();
  const name = profile?.display_name ?? profile?.full_name ?? user?.email?.split("@")[0] ?? "traveler";
  return (
    <SiteLayout>
      <Container className="py-16 md:py-20">
        <header className="mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-5xl md:text-6xl mt-3">Hello, {name}.</h1>
          <p className="text-muted-foreground mt-4 max-w-xl">
            Your travel command center. Plan the next journey, revisit past ones, and let the AI keep watch on what matters.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ to, icon: Icon, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-3xl border border-border bg-card p-6 hover:border-primary/60 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <h2 className="font-display text-2xl mt-6">{label}</h2>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </Link>
          ))}
        </div>
      </Container>
    </SiteLayout>
  );
}
