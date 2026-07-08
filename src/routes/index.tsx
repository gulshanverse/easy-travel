import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, ArrowUpRight, ArrowRight, Compass, Wand2, ShieldCheck,
  Globe2, MapPin, PlayCircle, Command, CloudSun, Clock, Wallet, Thermometer,
  Sunrise, Mountain, Waves, Camera, Utensils, Snowflake, Wind, Mic, Paperclip,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { cn } from "@/lib/utils";

import heroImg from "@/assets/hero-ocean.jpg";
// Responsive hero — AVIF/WebP/JPEG at multiple widths for premium LCP.
// vite-imagetools generates the variants at build; JPEG stays as fallback.
import heroPicture from "@/assets/hero-ocean.jpg?w=800;1200;1600;2000&format=avif;webp;jpg&as=picture";
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
    links: [
      { rel: "canonical", href: "/" },
      // Preload the LCP hero — AVIF srcset first, JPEG fallback for legacy UAs.
      {
        rel: "preload",
        as: "image",
        href: heroPicture.img.src,
        imagesrcset: heroPicture.sources.avif,
        imagesizes: "100vw",
        fetchpriority: "high",
      } as unknown as { rel: string; href: string },
    ],
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

/** Ghost prompts the hero "types" for the visitor when idle.
 *  Creates the sensation the product is already thinking. */
const ambientPrompts = [
  "Five slow days in Lisbon in October — food, design, sunsets.",
  "A weekend of onsen and soba an hour outside Tokyo.",
  "Chasing aurora across Iceland — geothermal spas, black-sand coasts.",
  "Two weeks across Patagonia in shoulder season, mostly by bus.",
  "Ten days in Bali: yoga, surfing, one temple pilgrimage.",
];

function LandingPage() {
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const [ghostIdx, setGhostIdx] = useState(0);
  const [ghostText, setGhostText] = useState("");
  const [nowLisbon, setNowLisbon] = useState<string>("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  const submit = (text?: string) => {
    const q = (text ?? prompt).trim();
    if (!q) { navigate({ to: "/studio" }); return; }
    navigate({ to: "/studio", search: { prompt: q } as never });
  };

  // Ghost typing — only when the visitor hasn't started
  useEffect(() => {
    if (prompt || focused) { setGhostText(""); return; }
    const full = ambientPrompts[ghostIdx];
    let i = 0;
    let holdTimer: number | undefined;
    const typer = window.setInterval(() => {
      i += 1;
      setGhostText(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(typer);
        holdTimer = window.setTimeout(() => {
          setGhostIdx((n) => (n + 1) % ambientPrompts.length);
          setGhostText("");
        }, 2600);
      }
    }, 38);
    return () => { window.clearInterval(typer); if (holdTimer) window.clearTimeout(holdTimer); };
  }, [ghostIdx, prompt, focused]);

  // Ambient local time — a tiny piece of live intelligence in the corner
  useEffect(() => {
    const fmt = () => {
      try {
        const s = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hour12: false,
        }).format(new Date());
        setNowLisbon(s);
      } catch { setNowLisbon(""); }
    };
    fmt();
    const id = window.setInterval(fmt, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-size the composer as the traveller types
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [prompt]);

  return (
    <SiteLayout>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section
        aria-label="Easy Trip — the AI travel operating system"
        className="relative isolate flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden [@media(max-height:640px)]:min-h-[36rem]"
      >
        {/* Cinematic layered background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 overflow-hidden">
            <picture>
              <source type="image/avif" srcSet={heroPicture.sources.avif} sizes="100vw" />
              <source type="image/webp" srcSet={heroPicture.sources.webp} sizes="100vw" />
              <img
                src={heroPicture.img.src}
                srcSet={heroPicture.sources.jpg ?? heroImg}
                sizes="100vw"
                alt=""
                width={heroPicture.img.w}
                height={heroPicture.img.h}
                className="h-full w-full object-cover ken-burns will-change-transform"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>

          {/* Ink from the top, warmth at the horizon */}
          <div className="absolute inset-0 bg-gradient-to-b from-brand-ink/85 via-brand-navy/40 to-brand-ink/70" />

          {/* Slow sunrise beam sweeping across the scene */}
          <div
            aria-hidden
            className="absolute -top-24 -left-24 h-[85%] w-[75%] blur-3xl light-beam"
            style={{
              background:
                "radial-gradient(60% 40% at 30% 30%, color-mix(in oklab, var(--brand-sunrise) 60%, transparent), transparent 70%)",
            }}
          />

          {/* Aurora bloom drifting from the horizon */}
          <div
            aria-hidden
            className="absolute -bottom-40 -right-32 h-[75%] w-[65%] blur-3xl aurora-drift"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--brand-teal) 55%, transparent), transparent 70%)",
            }}
          />

          {/* Ultra-wide balance — a faint far-shore horizon on the right, only visible >1600px */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] 2xl:block"
            style={{
              background:
                "radial-gradient(60% 55% at 70% 55%, color-mix(in oklab, var(--brand-navy) 45%, transparent), transparent 72%)",
            }}
          />
          {/* Ultra-wide — a whisper of a route line, drawn as a compass arc */}
          <svg
            aria-hidden
            viewBox="0 0 800 800"
            className="pointer-events-none absolute -right-24 top-1/2 hidden h-[42rem] w-[42rem] -translate-y-1/2 opacity-[0.09] 2xl:block"
            fill="none"
          >
            <circle cx="400" cy="400" r="360" stroke="white" strokeWidth="0.6" strokeDasharray="2 6" />
            <circle cx="400" cy="400" r="240" stroke="white" strokeWidth="0.6" />
            <path d="M60,540 C220,300 480,220 740,320" stroke="var(--brand-sunrise)" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="740" cy="320" r="3" fill="var(--brand-sunrise)" />
            <circle cx="60" cy="540" r="3" fill="white" />
          </svg>

          {/* Atmospheric depth — invisible-luxury mist. Extremely low opacity by design. */}
          <div aria-hidden className="absolute inset-0 mist-a" />
          <div aria-hidden className="absolute inset-0 mist-b" />
          <div aria-hidden className="absolute inset-0 dust-motes" />

          {/* Vignette + film grain for a photographed feel */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_25%,transparent_38%,oklch(0.09_0.03_245/0.65)_100%)]" />
          <div className="absolute inset-0 grain" aria-hidden />
        </div>

        {/* ── Corner marks — luxury cartographer details ─────── */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden md:block">
          <div className="mx-auto flex max-w-[82rem] items-start justify-between px-6 pt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
            <div className="flex items-center gap-6">
              <span className="inline-flex items-center gap-2"><Compass className="h-3 w-3" /> N · 38.72°</span>
              <span className="hidden lg:inline">W · 9.14°</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="hidden lg:inline">Golden hour · 19:04</span>
              <span className="inline-flex items-center gap-2"><Wind className="h-3 w-3" /> NW · 12 kt</span>
              <span className="inline-flex items-center gap-2"><Thermometer className="h-3 w-3" /> 22° · Clear</span>
              <span className="inline-flex items-center gap-2 tabular-nums">
                <Clock className="h-3 w-3" /> {nowLisbon || "—"} LIS
              </span>
            </div>
          </div>
        </div>

        {/* ── Hero content ───────────────────────────────────── */}
        <Container className="relative z-10 flex flex-1 flex-col justify-center pt-20 pb-20 sm:pt-24 sm:pb-28 md:pt-32 md:pb-24 [@media(max-height:640px)]:pt-16 [@media(max-height:640px)]:pb-14">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.28em] text-white/80 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-coral/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-coral" />
              </span>
              The AI Travel Operating System
            </div>

            <h1 className="mt-8 font-display text-white text-[2.75rem] leading-[0.95] tracking-[-0.03em] sm:text-6xl md:text-[5.75rem] lg:text-[7rem]">
              Describe a trip.
              <span className="mt-1 block font-editorial italic text-brand-sunrise">
                Watch it become a journey.
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/75 md:text-xl">
              One sentence begins an unforgettable adventure. Easy Trip listens,
              understands, and quietly assembles every detail — grounded in real
              flights, real hotels, real weather.
            </p>

            {/* ── Floating command center ─────────────────────── */}
            <form
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="mt-10 max-w-2xl"
            >
              <div
                className={cn(
                  "group relative rounded-[28px] p-[1.5px] transition-all duration-500",
                  focused || prompt
                    ? "bg-[conic-gradient(from_180deg,var(--brand-coral),var(--brand-sunrise),var(--brand-teal),var(--brand-coral))] shadow-[0_40px_120px_-30px_oklch(0_0_0/0.65)]"
                    : "bg-gradient-to-br from-white/25 via-white/10 to-white/5 shadow-[0_30px_90px_-30px_oklch(0_0_0/0.6)]",
                )}
              >
                <div className="rounded-[calc(28px-1.5px)] bg-brand-ink/60 backdrop-blur-2xl">
                  {/* Composer body */}
                  <div className="flex items-start gap-3 p-4 md:p-5">
                    <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-coral to-brand-sunrise text-white shadow-[var(--shadow-coral)]">
                      <Sparkles className="h-4 w-4" />
                    </span>

                    <label className="sr-only" htmlFor="landing-prompt">Describe your trip</label>
                    <div className="relative flex-1">
                      <textarea
                        id="landing-prompt"
                        ref={taRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                        rows={1}
                        aria-label="Describe your trip"
                        placeholder=" "
                        className="min-h-[2.75rem] w-full resize-none bg-transparent py-1.5 text-[17px] leading-snug text-white outline-none md:text-[19px]"
                      />
                      {/* Ghost prompt — the AI already thinking */}
                      {!prompt && !focused && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 py-1.5 text-[17px] leading-snug text-white/45 md:text-[19px]"
                        >
                          {ghostText}
                          <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] rounded-full bg-brand-sunrise caret-blink align-middle" />
                        </span>
                      )}
                    </div>

                    <button
                      type="submit"
                      aria-label="Begin journey"
                      className="press mt-0.5 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-white px-4 text-sm font-medium text-brand-ink shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl md:h-12 md:px-5"
                    >
                      Begin <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Toolbelt — voice, attach, autocomplete, shortcut */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/60">
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label="Voice input" className="press inline-flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                        <Mic className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label="Attach itinerary or photo" className="press inline-flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                        <Paperclip className="h-3.5 w-3.5" />
                      </button>
                      <span className="mx-1 hidden h-4 w-px bg-white/15 sm:inline-block" />
                      <span className="hidden items-center gap-1.5 font-mono uppercase tracking-[0.18em] sm:inline-flex">
                        <span className="h-1 w-1 rounded-full bg-brand-mint" />
                        Grounded · Weather-aware · Visa-aware
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Command className="h-3 w-3" />⏎ to begin
                    </span>
                  </div>
                </div>
              </div>

              {/* Prompt suggestions — the companion offering starting points */}
              <div className="mt-4 flex flex-wrap gap-2">
                {prompts.slice(0, 4).map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => submit(p)}
                    style={{ animationDelay: `${400 + i * 120}ms` }}
                    className="rise-in rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs text-white/80 backdrop-blur transition hover:-translate-y-0.5 hover:border-brand-coral/50 hover:bg-white/10 hover:text-white"
                  >
                    "{p.length > 62 ? p.slice(0, 60) + "…" : p}"
                  </button>
                ))}
              </div>
            </form>
          </div>
        </Container>

        {/* ── Ambient hero footer — trust + scroll cue ────────── */}
        <div className="relative z-10 border-t border-white/10 bg-gradient-to-t from-brand-ink/70 to-transparent">
          <Container className="flex flex-wrap items-center justify-between gap-4 py-4 text-[10px] font-mono uppercase tracking-[0.28em] text-white/55">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-mint" /> Real-time weather</span>
              <span className="inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-mint" /> Millions of routes</span>
              <span className="inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-mint" /> Updated continuously</span>
              <span className="hidden lg:inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-mint" /> Never a hallucinated hotel</span>
            </div>
            <span className="inline-flex items-center gap-2 text-white/45">
              Scroll to explore
              <span aria-hidden className="inline-block h-3 w-px bg-gradient-to-b from-white/60 to-transparent" />
            </span>
          </Container>
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

      {/* ── MOMENTS: EDITORIAL MARQUEE ───────────────────────── */}
      <section aria-label="Moments of travel" className="relative overflow-hidden border-y border-border/50 bg-brand-ink py-14 text-white">
        <div className="absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-brand-coral/40 blur-3xl aurora-drift" />
          <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-brand-teal/40 blur-3xl aurora-drift" style={{ animationDelay: "-6s" }} />
        </div>
        <div className="absolute inset-0 grain" aria-hidden />
        <div className="relative">
          <p className="mb-6 text-center font-mono text-[10px] uppercase tracking-[0.32em] text-white/55">
            ✦ Moments worth chasing ✦
          </p>
          <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
            <div className="marquee flex shrink-0 items-center gap-10 whitespace-nowrap pr-10">
              {[...moments, ...moments].map((m, i) => (
                <span key={`${m.label}-${i}`} className="inline-flex items-baseline gap-3">
                  <span className="font-display text-3xl leading-none tracking-[-0.02em] text-white sm:text-4xl md:text-5xl">
                    {m.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand-sunrise/80">
                    {m.sub}
                  </span>
                  <span aria-hidden className="text-brand-coral/70">·</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CHAPTERS: EDITORIAL DESTINATION GRID ─────────────── */}
      <section className="relative border-b border-border/60 bg-brand-linen py-24 md:py-32">
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

          <div className="grid grid-cols-12 gap-4 md:gap-6">
            {chapters.map((c, i) => {
              const span =
                c.kind === "wide"
                  ? "col-span-12 md:col-span-8 aspect-[16/10]"
                  : "col-span-12 sm:col-span-6 md:col-span-4 aspect-[3/4]";
              return (
                <button
                  key={c.name}
                  onClick={() => submit(c.prompt)}
                  className={`group relative overflow-hidden rounded-[1.75rem] bg-muted text-left ring-1 ring-border/50 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:aurora-ring hover:ring-brand-coral/40 ${span}`}
                >
                  <img
                    src={c.img}
                    alt={`${c.name}, ${c.country}`}
                    loading={i < 2 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.075]"
                  />
                  {/* Cinematic dual-gradient — bottom ink, top mood tint */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-brand-ink/25 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-brand-ink/40 via-transparent to-transparent" />
                  {/* Animated coral wash on hover */}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-tr from-transparent via-brand-coral/0 to-brand-sunrise/0 opacity-0 transition-opacity duration-700 group-hover:opacity-30" />

                  {/* Top row — chapter + coordinates */}
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5 sm:p-6">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-white/85 backdrop-blur">
                      {c.tag}
                    </span>
                    <span className="hidden rounded-full bg-black/25 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-white/70 backdrop-blur sm:inline-flex">
                      {c.coord}
                    </span>
                  </div>

                  {/* Bottom editorial block */}
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-brand-sunrise">
                      <span>{c.country}</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-brand-sunrise/50 to-transparent" />
                      <span className="text-white/60">{c.mood}</span>
                    </div>
                    <h3 className="mt-1.5 font-display text-4xl leading-[0.95] tracking-[-0.02em] sm:text-5xl md:text-6xl">
                      {c.name}
                    </h3>
                    <p className="mt-3 max-w-md font-editorial text-lg leading-snug text-white/90">
                      {c.line}
                    </p>

                    {/* Metadata rail — season, temp, duration */}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/85 backdrop-blur">
                        <CloudSun className="h-3 w-3 text-brand-sunrise" /> {c.season}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/85 backdrop-blur">
                        <Thermometer className="h-3 w-3 text-brand-coral" /> {c.temp}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/85 backdrop-blur">
                        <Clock className="h-3 w-3 text-brand-mint" /> {c.duration}
                      </span>
                    </div>

                    {/* Draft CTA row */}
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {c.experiences.map((Icon, k) => (
                          <span key={k} className="grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur transition group-hover:border-brand-coral/60 group-hover:text-white">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-brand-ink opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0 translate-x-1">
                        Draft this journey <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
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
