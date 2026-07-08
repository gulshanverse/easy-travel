import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, ArrowUpRight, ArrowRight, Compass, Wand2, ShieldCheck,
  Globe2, MapPin, PlayCircle, Command, CloudSun, Clock, Wallet, Thermometer,
  Sunrise, Mountain, Waves, Camera, Utensils, Snowflake,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";

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
      { title: "Easy Trip — The AI Travel Operating System" },
      {
        name: "description",
        content:
          "Describe a trip. Watch it become a journey. Easy Trip is the AI-native travel workspace for planning, comparing and living every trip in one place.",
      },
      { property: "og:title", content: "Easy Trip — The AI Travel Operating System" },
      { property: "og:description", content: "Describe a trip. Watch it become a journey." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LandingPage,
});

const prompts = [
  "Five slow days in Lisbon in October — food, design, sunsets.",
  "Weekend under ₹20,000 from Mumbai, somewhere I've never been.",
  "Honeymoon: two weeks, Japan, boutique ryokans only.",
  "Family of four, spring break, warm, under 6h flight from NYC.",
  "A month across the Balkans, slow trains, minimal flights.",
  "Find me snow next month — I'm flexible on where.",
];

const chapters = [
  {
    kind: "wide",
    img: destIceland,
    tag: "Chapter 01 · Wonder",
    name: "Reykjavik",
    country: "Iceland",
    coord: "64.15°N · 21.94°W",
    line: "Where aurora rewrites the night in green ink.",
    prompt: "A week in Iceland chasing the northern lights — geothermal spas, black-sand coasts.",
    season: "Sep – Mar",
    temp: "−2 – 4°C",
    duration: "7 nights",
    mood: "Wonder",
    experiences: [Snowflake, Mountain, Camera],
  },
  {
    kind: "tall",
    img: destTokyo,
    tag: "Chapter 02 · Rhythm",
    name: "Tokyo",
    country: "Japan",
    coord: "35.68°N · 139.69°E",
    line: "Twelve million people, one perfect bowl of soba.",
    prompt: "Five days in Tokyo, food-first, with one day in Kamakura.",
    season: "Mar – May · Oct – Nov",
    temp: "14 – 22°C",
    duration: "5 nights",
    mood: "Rhythm",
    experiences: [Utensils, Camera],
  },
  {
    kind: "tall",
    img: destMarrakech,
    tag: "Chapter 03 · Colour",
    name: "Marrakech",
    country: "Morocco",
    coord: "31.63°N · 7.99°W",
    line: "A city that measures time in mint tea and shadow.",
    prompt: "Four days in Marrakech, riads, souks, one desert night.",
    season: "Oct – Apr",
    temp: "18 – 24°C",
    duration: "4 nights",
    mood: "Colour",
    experiences: [Sunrise, Camera, Utensils],
  },
  {
    kind: "wide",
    img: destDolomites,
    tag: "Chapter 04 · Height",
    name: "Dolomites",
    country: "Italy",
    coord: "46.40°N · 11.85°E",
    line: "Cathedral peaks, refuge cheese, silence loud enough to hear.",
    prompt: "Six-day hut-to-hut hike across the Dolomites, moderate difficulty.",
    season: "Jun – Sep",
    temp: "10 – 20°C",
    duration: "6 nights",
    mood: "Altitude",
    experiences: [Mountain, Camera],
  },
  {
    kind: "tall",
    img: destBali,
    tag: "Chapter 05 · Slow",
    name: "Bali",
    country: "Indonesia",
    coord: "8.34°S · 115.09°E",
    line: "The island that turned rest into an art form.",
    prompt: "Ten days in Bali: yoga, surfing, one temple pilgrimage.",
    season: "Apr – Oct",
    temp: "26 – 30°C",
    duration: "10 nights",
    mood: "Slow",
    experiences: [Waves, Sunrise, Utensils],
  },
  {
    kind: "tall",
    img: destLisbon,
    tag: "Chapter 06 · Light",
    name: "Lisbon",
    country: "Portugal",
    coord: "38.72°N · 9.14°W",
    line: "Yellow trams, blue tiles, the Atlantic just around the corner.",
    prompt: "Long weekend in Lisbon: pastel de nata, viewpoints, day trip to Sintra.",
    season: "Apr – Oct",
    temp: "18 – 26°C",
    duration: "4 nights",
    mood: "Light",
    experiences: [Utensils, Camera, Waves],
  },
];

const moments = [
  { label: "Golden hour", sub: "Lisbon, Portugal" },
  { label: "Hidden villages", sub: "Umbria, Italy" },
  { label: "Northern lights", sub: "Tromsø, Norway" },
  { label: "Night trains", sub: "Vienna → Venice" },
  { label: "Local cafés", sub: "Hanoi, Vietnam" },
  { label: "Mountain roads", sub: "Transfăgărășan" },
  { label: "Ocean escapes", sub: "Kefalonia, Greece" },
  { label: "Sunrise viewpoints", sub: "Bagan, Myanmar" },
  { label: "Slow travel", sub: "Kyoto → Nara" },
  { label: "Desert silence", sub: "Wadi Rum, Jordan" },
];

const capabilities = [
  { icon: Wand2, title: "AI Planner", line: "Describe intent. Get a real itinerary — flights, stays, days, budget — grounded in live data." },
  { icon: Compass, title: "Journey Studio", line: "A cinematic workspace to shape, edit and live every trip. Not a form. A canvas." },
  { icon: Globe2, title: "Travel Intelligence", line: "Weather, visas, safety, recs — a running briefing that quietly updates itself." },
  { icon: ShieldCheck, title: "Never hallucinated", line: "Every hotel, price and route ties back to a real provider. No made-up places." },
];

function LandingPage() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();

  const submit = (text?: string) => {
    const q = (text ?? prompt).trim();
    if (!q) { navigate({ to: "/studio" }); return; }
    // Handoff to Studio via URL; StudioContext will pick it up if wired later.
    navigate({ to: "/studio", search: { prompt: q } as never });
  };

  return (
    <SiteLayout>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={heroImg}
              alt=""
              className="h-full w-full object-cover ken-burns will-change-transform"
              fetchPriority="high"
            />
          </div>
          {/* Atmospheric depth: ink from the top, warmth at the horizon, canvas beneath */}
          <div className="absolute inset-0 bg-gradient-to-b from-brand-ink/90 via-brand-navy/55 to-background" />
          {/* Sunrise light-beam sweeping across the scene */}
          <div
            aria-hidden
            className="absolute -top-24 -left-24 h-[80%] w-[70%] blur-3xl light-beam"
            style={{
              background:
                "radial-gradient(60% 40% at 30% 30%, color-mix(in oklab, var(--brand-sunrise) 55%, transparent), transparent 70%)",
            }}
          />
          {/* Aurora bloom bottom-right */}
          <div
            aria-hidden
            className="absolute -bottom-32 -right-24 h-[70%] w-[60%] blur-3xl aurora-drift"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--brand-teal) 50%, transparent), transparent 70%)",
            }}
          />
          {/* Vignette + film grain for a photographed feel */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_20%,transparent_40%,oklch(0.09_0.03_245/0.55)_100%)]" />
          <div className="absolute inset-0 grain" aria-hidden />
        </div>

        <Container className="relative pt-24 pb-28 md:pt-40 md:pb-40">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 text-white/85">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.22em] backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-coral animate-pulse" />
                The AI Travel OS · v2
              </span>
              <span className="hidden text-[11px] font-mono uppercase tracking-[0.22em] text-white/55 sm:inline">
                Est. 2026 · Made for humans who love to move
              </span>
            </div>

            <h1 className="mt-8 font-display text-white text-5xl leading-[0.94] tracking-[-0.03em] sm:text-6xl md:text-[5.5rem] lg:text-[6.5rem]">
              Describe a trip.
              <span className="block font-editorial text-brand-sunrise">
                Watch it become a journey.
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/80">
              Easy Trip is your AI travel companion — a single, calm workspace
              where planning, comparing and living a trip finally happen in the
              same place.
            </p>

            {/* AI-first prompt — the product IS the search bar */}
            <form
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="mt-10 max-w-2xl"
            >
              <div className="rounded-3xl bg-white/[0.06] p-[1.5px] shadow-[0_30px_80px_-30px_oklch(0_0_0/0.5)] ring-1 ring-white/15 backdrop-blur-xl transition focus-within:ring-brand-coral/70 focus-within:shadow-[var(--shadow-coral)]">
                <div className="rounded-[calc(1.5rem-1.5px)] bg-brand-ink/50 backdrop-blur-xl">
                  <div className="flex items-start gap-3 p-4">
                    <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-coral to-brand-sunrise text-white shadow-lg">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <label className="sr-only" htmlFor="landing-prompt">Describe your trip</label>
                    <textarea
                      id="landing-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                      rows={2}
                      placeholder="Where would you like to wander next?"
                      className="min-h-[3.5rem] flex-1 resize-none bg-transparent py-2 text-[17px] leading-snug text-white outline-none placeholder:text-white/45"
                    />
                    <button
                      type="submit"
                      aria-label="Begin journey"
                      className="press mt-1 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-white px-4 text-sm font-medium text-brand-ink shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                    >
                      Begin <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-2 text-[11px] text-white/60">
                    <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.18em]">
                      <span className="h-1 w-1 rounded-full bg-brand-mint" />
                      Grounded in real data
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Command className="h-3 w-3" />⏎ to begin · Shift⏎ new line
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {prompts.slice(0, 4).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => submit(p)}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs text-white/80 backdrop-blur transition hover:-translate-y-0.5 hover:border-brand-coral/50 hover:bg-white/10 hover:text-white"
                  >
                    "{p.length > 62 ? p.slice(0, 60) + "…" : p}"
                  </button>
                ))}
              </div>
            </form>

            <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 text-[11px] font-mono uppercase tracking-[0.22em] text-white/50">
              <span className="inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-mint" /> Live prices</span>
              <span className="inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-mint" /> Real hotels</span>
              <span className="inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-mint" /> Weather-aware</span>
              <span className="inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-mint" /> Visa-aware</span>
            </div>
          </div>
        </Container>

        {/* Scroll indicator */}
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <span className="inline-flex flex-col items-center gap-1 text-[10px] font-mono uppercase tracking-[0.3em] text-white/45">
            Scroll to explore
            <span className="mt-1 h-8 w-px bg-gradient-to-b from-white/40 to-transparent" />
          </span>
        </div>
      </section>

      {/* ── EDITORIAL: THE STORY ─────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        <Container>
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-20">
            <div>
              <p className="eyebrow">§ 01 · Why we built it</p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-[-0.025em] sm:text-5xl md:text-6xl">
                Travel is emotional.
                <span className="block font-editorial text-brand-coral">Software rarely is.</span>
              </h2>
            </div>
            <div className="space-y-5 pt-2 text-lg leading-relaxed text-foreground/80">
              <p>
                Twenty tabs, three booking sites, a spreadsheet nobody opens.
                The tools we use to plan the best moments of our lives feel like
                the tools we use to file taxes.
              </p>
              <p>
                Easy Trip is our answer: <span className="font-editorial text-foreground">a single, calm workspace</span> where
                you describe a trip in your own words, watch it take shape day
                by day, and live it from the same place you dreamt it up.
              </p>
              <p className="text-sm font-mono uppercase tracking-[0.22em] text-brand-coral">
                — The Easy Trip studio
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ── CHAPTERS: EDITORIAL DESTINATION GRID ─────────────── */}
      <section className="relative border-y border-border/60 bg-brand-linen py-24 md:py-32">
        <Container>
          <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">§ 02 · Six chapters</p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-[-0.025em] sm:text-5xl md:text-6xl max-w-xl">
                The world, told as
                <span className="font-editorial text-brand-coral"> stories</span>.
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Every card is a prompt. Tap one and the Studio drafts it — day by
              day, with real activities, budget, and travel-day flow.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-4 md:gap-5">
            {chapters.map((c, i) => {
              const span =
                c.kind === "wide"
                  ? "col-span-12 md:col-span-8 aspect-[16/10]"
                  : "col-span-12 sm:col-span-6 md:col-span-4 aspect-[3/4]";
              return (
                <button
                  key={c.name}
                  onClick={() => submit(c.prompt)}
                  className={`group relative overflow-hidden rounded-[1.75rem] bg-muted text-left ring-1 ring-border/50 transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-3)] hover:ring-brand-coral/30 ${span}`}
                >
                  <img
                    src={c.img}
                    alt={`${c.name}, ${c.country}`}
                    loading={i < 2 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-brand-ink/20 to-transparent" />
                  <div className="absolute inset-x-0 top-0 p-6">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-white/85 backdrop-blur">
                      {c.tag}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-sunrise">
                      {c.country}
                    </p>
                    <h3 className="mt-1 font-display text-4xl leading-[0.95] tracking-[-0.02em] sm:text-5xl">
                      {c.name}
                    </h3>
                    <p className="mt-3 max-w-md font-editorial text-lg leading-snug text-white/90">
                      {c.line}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-white/90 opacity-70 transition group-hover:opacity-100">
                      Draft this journey <ArrowUpRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── CAPABILITIES ─────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <Container>
          <div className="grid gap-14 md:grid-cols-[1fr_2fr] md:gap-24">
            <div className="md:sticky md:top-28 md:self-start">
              <p className="eyebrow">§ 03 · Under the hood</p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-[-0.025em] sm:text-5xl">
                One platform.
                <span className="block font-editorial text-brand-coral">Every part of the trip.</span>
              </h2>
              <p className="mt-6 max-w-sm text-base leading-relaxed text-muted-foreground">
                An AI-native travel operating system. Everything that used to
                live in a dozen apps now lives in one calm workspace.
              </p>
            </div>

            <ul className="divide-y divide-border/70 border-y border-border/70">
              {capabilities.map((c) => (
                <li key={c.title} className="group grid grid-cols-[auto_1fr_auto] items-start gap-6 py-8">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border/60 bg-card text-brand-coral transition-all duration-500 group-hover:-translate-y-0.5 group-hover:border-brand-coral/40 group-hover:shadow-[var(--shadow-2)]">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">
                      {c.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
                      {c.line}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-2 hidden h-5 w-5 text-muted-foreground transition-all group-hover:text-brand-coral md:block" />
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── THE VOICE ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-ink py-32 text-white">
        <div className="absolute inset-0 opacity-40">
          <img src={destLisbon} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-brand-ink/60 via-brand-ink/85 to-brand-ink" />
        <div className="absolute inset-0 grain" aria-hidden />
        <Container className="relative">
          <div className="mx-auto max-w-4xl text-center">
            <MapPin className="mx-auto h-6 w-6 text-brand-coral" />
            <blockquote className="mt-8 font-display text-3xl leading-[1.15] tracking-[-0.02em] text-white sm:text-5xl md:text-6xl">
              "I described a two-week trip through Japan
              <span className="block font-editorial text-brand-sunrise">and it handed me a life.</span>
              Real flights. Real ryokans. Restaurants I'd actually book."
            </blockquote>
            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.28em] text-white/60">
              Amelia R. · Planned her honeymoon in 12 minutes
            </p>
          </div>
        </Container>
      </section>

      {/* ── FINAL INVITATION ─────────────────────────────────── */}
      <section className="relative py-28 md:py-36">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">§ 04 · Your move</p>
            <h2 className="mt-6 font-display text-5xl leading-[1] tracking-[-0.03em] sm:text-6xl md:text-7xl">
              Your next trip is
              <span className="block font-editorial text-brand-coral">one sentence away.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground">
              Sign up free. Save trips. Sync across devices. The Studio remembers
              how you travel — and gets sharper every journey.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                className="press inline-flex h-12 items-center gap-2 rounded-full bg-brand-ink px-6 text-sm font-medium text-white shadow-[var(--shadow-2)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-3)]"
              >
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/studio"
                className="press inline-flex h-12 items-center gap-2 rounded-full border border-border bg-transparent px-6 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-brand-coral/50 hover:text-brand-coral"
              >
                <PlayCircle className="h-4 w-4" /> Open the Studio
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </SiteLayout>
  );
}
