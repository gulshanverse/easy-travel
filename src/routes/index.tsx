import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Plane,
  Hotel,
  MapPin,
  Compass,
  Search,
  Wand2,
  ShieldCheck,
  Zap,
  Globe2,
  ArrowRight,
  Star,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import heroImg from "@/assets/hero-ocean.jpg";
import destTokyo from "@/assets/dest-tokyo.jpg";
import destBali from "@/assets/dest-bali.jpg";
import destIceland from "@/assets/dest-iceland.jpg";
import destMarrakech from "@/assets/dest-marrakech.jpg";
import destDolomites from "@/assets/dest-dolomites.jpg";
import destLisbon from "@/assets/dest-lisbon.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Easy Trip — Travel Smarter with AI" },
      {
        name: "description",
        content:
          "AI-first travel platform to discover destinations, compare flights and stays, and generate itineraries in seconds.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LandingPage,
});

const destinations = [
  { slug: "tokyo", name: "Tokyo", country: "Japan", img: destTokyo, tag: "Neon nights" },
  { slug: "bali", name: "Bali", country: "Indonesia", img: destBali, tag: "Island calm" },
  { slug: "iceland", name: "Reykjavik", country: "Iceland", img: destIceland, tag: "Aurora season" },
  { slug: "marrakech", name: "Marrakech", country: "Morocco", img: destMarrakech, tag: "Ancient medinas" },
  { slug: "dolomites", name: "Dolomites", country: "Italy", img: destDolomites, tag: "Alpine escapes" },
  { slug: "lisbon", name: "Lisbon", country: "Portugal", img: destLisbon, tag: "Golden hour city" },
];

const features = [
  {
    icon: Wand2,
    title: "AI Itineraries in seconds",
    text: "Describe the trip you want — our planner assembles flights, stays, and experiences that actually fit together.",
  },
  {
    icon: Zap,
    title: "One booking flow",
    text: "Flights, hotels, trains, buses, cabs, and restaurants — compared and booked from a single interface.",
  },
  {
    icon: ShieldCheck,
    title: "Grounded in real data",
    text: "Live prices, verified reviews, and clear cancellation terms. No hallucinated hotels, ever.",
  },
  {
    icon: Globe2,
    title: "Built for real travelers",
    text: "Save trips, share with your crew, and pick up planning from any device — anywhere in the world.",
  },
];

function LandingPage() {
  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroImg}
            alt=""
            width={1920}
            height={1280}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/70 via-brand-navy/50 to-background" />
        </div>

        <Container className="pt-24 pb-32 md:pt-36 md:pb-44 relative">
          <Badge
            variant="secondary"
            className="rounded-full bg-white/10 text-white border-white/20 backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> New — AI Planner v2
          </Badge>
          <h1 className="mt-6 font-display text-white text-6xl md:text-7xl lg:text-8xl leading-[0.98] max-w-4xl">
            Travel smarter, <em className="text-brand-mint not-italic italic">not harder.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/85">
            Easy Trip is your AI travel companion — discover, plan, compare,
            organize, and book your next adventure through one intelligent
            interface.
          </p>

          {/* Search widget */}
          <div className="mt-10 max-w-3xl rounded-2xl glass border border-white/15 p-2 shadow-2xl shadow-brand-navy/30">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <div className="flex items-center gap-3 px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                <Input
                  className="border-0 shadow-none focus-visible:ring-0 h-auto px-0 text-base bg-transparent"
                  placeholder="Where do you dream of going? Try 'a week in Kyoto in April'…"
                  aria-label="Search destinations or describe your trip"
                />
              </div>
              <Button asChild size="lg" className="rounded-xl h-12 px-6">
                <Link to="/ai-planner">
                  Plan with AI <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-3 pb-2 pt-1">
              {["Northern lights", "Bali honeymoon", "Solo Kyoto", "Family Rome"].map((s) => (
                <button
                  key={s}
                  className="text-xs rounded-full px-2.5 py-1 text-white/85 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quick nav */}
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { to: "/flights", icon: Plane, label: "Flights" },
              { to: "/hotels", icon: Hotel, label: "Hotels" },
              { to: "/experiences", icon: Compass, label: "Experiences" },
              { to: "/destinations", icon: MapPin, label: "Destinations" },
            ].map(({ to, icon: Icon, label }) => (
              <Button
                key={to}
                asChild
                variant="ghost"
                className="rounded-full text-white hover:bg-white/10 hover:text-white"
              >
                <Link to={to}>
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              </Button>
            ))}
          </div>
        </Container>
      </section>

      {/* DESTINATIONS GRID */}
      <section className="py-20 md:py-28">
        <Container>
          <div className="flex items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">
                Where to next
              </p>
              <h2 className="font-display text-4xl md:text-5xl max-w-2xl">
                Curated destinations, chosen by travelers like you.
              </h2>
            </div>
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <Link to="/destinations">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {destinations.map((d, i) => (
              <Link
                key={d.slug}
                to="/destinations"
                className="group relative overflow-hidden rounded-2xl bg-muted aspect-[4/5] block"
              >
                <img
                  src={d.img}
                  alt={`${d.name}, ${d.country}`}
                  width={1200}
                  height={1500}
                  loading={i < 3 ? "eager" : "lazy"}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <span className="text-xs uppercase tracking-widest text-brand-mint">
                    {d.tag}
                  </span>
                  <h3 className="mt-1 font-display text-3xl leading-none">
                    {d.name}
                  </h3>
                  <p className="text-sm text-white/75">{d.country}</p>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* FEATURES */}
      <section className="py-20 md:py-24 bg-muted/40 border-y border-border/60">
        <Container>
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">
            Why Easy Trip
          </p>
          <h2 className="font-display text-4xl md:text-5xl max-w-3xl">
            Everything you need to plan a trip — nothing you don't.
          </h2>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-2xl leading-tight">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-24">
        <Container>
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center gap-1 text-accent mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="font-display text-3xl md:text-4xl leading-snug text-foreground">
              "I described a two-week trip through Japan and Easy Trip handed
              me a full itinerary — with real flights, real ryokans, and
              restaurants I'd actually want to book."
            </blockquote>
            <p className="mt-6 text-sm text-muted-foreground">
              Amelia R. — planned her honeymoon in 12 minutes
            </p>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-brand-navy text-white p-10 md:p-16">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-teal/40 blur-3xl" />
            <div className="absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-brand-mint/30 blur-3xl" />
            <div className="relative max-w-2xl">
              <h2 className="font-display text-4xl md:text-5xl leading-tight">
                Your next trip is one prompt away.
              </h2>
              <p className="mt-4 text-white/80">
                Sign up free — save trips, sync across devices, and get AI
                recommendations tailored to how you travel.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full bg-white text-brand-navy hover:bg-white/90">
                  <Link to="/auth">Create free account</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <Link to="/ai-planner">Try AI Planner</Link>
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </SiteLayout>
  );
}
