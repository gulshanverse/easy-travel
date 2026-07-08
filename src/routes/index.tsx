import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, ArrowUpRight, ArrowRight, Compass, Wand2, ShieldCheck,
  Globe2, MapPin, PlayCircle, Command, CloudSun, Clock, Thermometer,
  Sunrise, Mountain, Waves, Camera, Utensils, Snowflake, Wind, Mic, Paperclip,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import heroImg from "@/assets/hero-ocean.jpg";
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

/** Destination cards, now with a per-place environmental language
 *  (Sprint 2 §4) and an editorial caption revealed on hover (§1). */
type EnvKind = "iceland" | "tokyo" | "marrakech" | "dolomites" | "bali" | "lisbon";
type Chapter = {
  kind: "wide" | "tall";
  img: string;
  tag: string;
  name: string;
  country: string;
  coord: string;
  line: string;
  prompt: string;
  season: string;
  temp: string;
  duration: string;
  mood: string;
  experiences: React.ComponentType<{ className?: string }>[];
  env: EnvKind;
  caption: string;
  reason: string;
};

const chapters: Chapter[] = [
  {
    kind: "wide", img: destIceland, tag: "Reykjavik", name: "Reykjavik", country: "Iceland",
    coord: "64.15°N · 21.94°W",
    line: "Where aurora rewrites the night in green ink.",
    prompt: "A week in Iceland chasing the northern lights — geothermal spas, black-sand coasts.",
    season: "Sep – Mar", temp: "−2 – 4°C", duration: "7 nights", mood: "Wonder",
    experiences: [Snowflake, Mountain, Camera],
    env: "iceland",
    caption: "Photographed at aurora hour, October.",
    reason: "Suggested because aurora forecast KP 5.2 for Tromsø tonight.",
  },
  {
    kind: "tall", img: destTokyo, tag: "Tokyo", name: "Tokyo", country: "Japan",
    coord: "35.68°N · 139.69°E",
    line: "Twelve million people, one perfect bowl of soba.",
    prompt: "Five days in Tokyo, food-first, with one day in Kamakura.",
    season: "Mar – May · Oct – Nov", temp: "14 – 22°C", duration: "5 nights", mood: "Rhythm",
    experiences: [Utensils, Camera], env: "tokyo",
    caption: "Field notes from a Shinjuku evening.",
    reason: "Suggested because you paused on Kyoto 12 s ago.",
  },
  {
    kind: "tall", img: destMarrakech, tag: "Marrakech", name: "Marrakech", country: "Morocco",
    coord: "31.63°N · 7.99°W",
    line: "A city that measures time in mint tea and shadow.",
    prompt: "Four days in Marrakech, riads, souks, one desert night.",
    season: "Oct – Apr", temp: "18 – 24°C", duration: "4 nights", mood: "Colour",
    experiences: [Sunrise, Camera, Utensils], env: "marrakech",
    caption: "Souk light, 4:47 pm.",
    reason: "Suggested because the seasonal window closes in 5 weeks.",
  },
  {
    kind: "wide", img: destDolomites, tag: "Dolomites", name: "Dolomites", country: "Italy",
    coord: "46.40°N · 11.85°E",
    line: "Cathedral peaks, refuge cheese, silence loud enough to hear.",
    prompt: "Six-day hut-to-hut hike across the Dolomites, moderate difficulty.",
    season: "Jun – Sep", temp: "10 – 20°C", duration: "6 nights", mood: "Altitude",
    experiences: [Mountain, Camera], env: "dolomites",
    caption: "Cortina, third refuge, first frost.",
    reason: "Suggested because refuges book 90 days ahead.",
  },
  {
    kind: "tall", img: destBali, tag: "Bali", name: "Bali", country: "Indonesia",
    coord: "8.34°S · 115.09°E",
    line: "The island that turned rest into an art form.",
    prompt: "Ten days in Bali: yoga, surfing, one temple pilgrimage.",
    season: "Apr – Oct", temp: "26 – 30°C", duration: "10 nights", mood: "Slow",
    experiences: [Waves, Sunrise, Utensils], env: "bali",
    caption: "Uluwatu, dry season.",
    reason: "Suggested because your last saved trip was coastal.",
  },
  {
    kind: "tall", img: destLisbon, tag: "Lisbon", name: "Lisbon", country: "Portugal",
    coord: "38.72°N · 9.14°W",
    line: "Yellow trams, blue tiles, the Atlantic just around the corner.",
    prompt: "Long weekend in Lisbon: pastel de nata, viewpoints, day trip to Sintra.",
    season: "Apr – Oct", temp: "18 – 26°C", duration: "4 nights", mood: "Light",
    experiences: [Utensils, Camera, Waves], env: "lisbon",
    caption: "Miradouro da Graça, golden hour.",
    reason: "Suggested because Lisbon sunset is in 2h 14m.",
  },
];

const moments = [
  { label: "Golden hour", sub: "Lisbon · trending +18% this week" },
  { label: "Hidden villages", sub: "Umbria · seasonal window closing" },
  { label: "Northern lights", sub: "Tromsø · KP 5.2 tonight" },
  { label: "Night trains", sub: "Vienna → Venice · shoulder season" },
  { label: "Local cafés", sub: "Hanoi · monsoon lifting" },
  { label: "Mountain roads", sub: "Transfăgărășan · pass open" },
  { label: "Ocean escapes", sub: "Kefalonia · water 23°C" },
  { label: "Sunrise viewpoints", sub: "Bagan · 06:14 local" },
  { label: "Slow travel", sub: "Kyoto → Nara · momiji peak" },
  { label: "Desert silence", sub: "Wadi Rum · new moon Thursday" },
];

const capabilities: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  line: string;
  footnote: string;
}[] = [
  { icon: Wand2, title: "AI Planner", line: "Describe intent. Get a real itinerary — flights, stays, days, budget — grounded in live data.", footnote: "324 itineraries drafted this hour" },
  { icon: Compass, title: "Journey Studio", line: "A cinematic workspace to shape, edit and live every trip. Not a form. A canvas.", footnote: "avg session · 14 min" },
  { icon: Globe2, title: "Travel Intelligence", line: "Weather, visas, safety, recs — a running briefing that quietly updates itself.", footnote: "weather source · last synced 43 s ago" },
  { icon: ShieldCheck, title: "Never hallucinated", line: "Every hotel, price and route ties back to a real provider. No made-up places.", footnote: "0 fabricated properties · lifetime" },
];

const ambientPrompts = [
  "Five slow days in Lisbon in October — food, design, sunsets.",
  "A weekend of onsen and soba an hour outside Tokyo.",
  "Chasing aurora across Iceland — geothermal spas, black-sand coasts.",
  "Two weeks across Patagonia in shoulder season, mostly by bus.",
  "Ten days in Bali: yoga, surfing, one temple pilgrimage.",
];

/** Live intelligence strip (§5 — AI presence in the hero). */
const liveIntel = [
  "Right now — 47 travellers are planning Iceland",
  "Aurora forecast tonight — KP 5.2 over Tromsø",
  "Lisbon golden hour in 2h 14m",
  "Kyoto momiji peak — 6 days remaining",
  "New moon over Wadi Rum on Thursday",
  "Refuges in the Dolomites — 12 beds left this week",
];

/** Small punctuation between chapters (§3). */
function ChapterDivider({ n, word, tone = "ink" }: { n: string; word: string; tone?: "ink" | "linen" }) {
  const dark = tone === "ink";
  return (
    <div className={cn("relative z-10", dark ? "bg-brand-ink text-white" : "bg-brand-linen text-brand-ink")}>
      <Container>
        <div className="flex items-center gap-4 py-6">
          <span aria-hidden className={cn("h-px flex-1", dark ? "bg-white/15" : "bg-brand-ink/10")} />
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden className="chapter-tick opacity-70">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="0.6" />
            <path d="M12 3 L14 12 L12 21 L10 12 Z" fill="currentColor" opacity="0.6" />
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] opacity-70">
            Chapter {n} · {word}
          </span>
          <span aria-hidden className={cn("h-px flex-1", dark ? "bg-white/15" : "bg-brand-ink/10")} />
        </div>
      </Container>
    </div>
  );
}

/** Per-destination environmental layer (§4). Mounted, opacity gated to hover. */
function DestinationEnv({ env, reduced }: { env: EnvKind; reduced: boolean }) {
  if (reduced) return null;
  const base = "absolute inset-0 opacity-0 transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-focus-visible:opacity-100";
  switch (env) {
    case "iceland":
      return (
        <>
          <div aria-hidden className={cn(base, "env-aurora")} />
          <div aria-hidden className={cn(base, "env-snow")} />
        </>
      );
    case "tokyo":
      return <div aria-hidden className={cn(base, "env-city")} />;
    case "marrakech":
      return <div aria-hidden className={cn(base, "env-warmbloom")} />;
    case "dolomites":
      return <div aria-hidden className={cn(base, "env-mist")} />;
    case "bali":
      return (
        <>
          <div aria-hidden className={cn(base, "env-water")} />
          <svg
            aria-hidden viewBox="0 0 100 100"
            className={cn(base, "env-palm-sway h-full w-full")}
            preserveAspectRatio="none"
          >
            <g fill="currentColor" opacity="0.28" className="text-brand-ink">
              <path d="M78 100 Q82 60 88 30 Q76 44 66 24 Q78 46 70 34 Q84 62 78 100 Z" />
              <path d="M78 100 Q74 62 62 40 Q78 50 84 26 Q76 48 88 40 Q84 62 78 100 Z" />
            </g>
          </svg>
        </>
      );
    case "lisbon":
      return (
        <>
          <div aria-hidden className={cn(base, "env-lisbon-pan")} />
          <div aria-hidden className={cn(base, "env-tram")} />
        </>
      );
  }
}

function LandingPage() {
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const [ghostIdx, setGhostIdx] = useState(0);
  const [ghostText, setGhostText] = useState("");
  const [nowLisbon, setNowLisbon] = useState<string>("");
  const [intelIdx, setIntelIdx] = useState(0);
  const [departing, setDeparting] = useState(false);
  const [birdKey, setBirdKey] = useState(0);
  const [birdTop, setBirdTop] = useState("14%");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const submit = (text?: string) => {
    const q = (text ?? prompt).trim();
    const search = q ? ({ prompt: q } as never) : undefined;
    if (reduced) {
      navigate(q ? { to: "/studio", search } : { to: "/studio" });
      return;
    }
    setDeparting(true);
    window.setTimeout(() => {
      navigate(q ? { to: "/studio", search } : { to: "/studio" });
    }, 400);
  };

  // Ghost typing
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

  // Ambient local time
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

  // Live intelligence rotator (§5)
  useEffect(() => {
    const id = window.setInterval(() => setIntelIdx((n) => (n + 1) % liveIntel.length), 6000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-size composer
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [prompt]);

  // Cursor bloom (§2, §7 #8)
  useEffect(() => {
    if (reduced) return;
    const hero = heroRef.current; const glow = cursorRef.current;
    if (!hero || !glow) return;
    let raf = 0; let tx = 0, ty = 0, cx = 0, cy = 0, visible = false;
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!visible) { visible = true; glow.style.opacity = "1"; }
    };
    const onLeave = () => { visible = false; glow.style.opacity = "0"; };
    const tick = () => {
      cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
      glow.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Bird glide — one bird at a time, 55–90 s cadence (§2)
  useEffect(() => {
    if (reduced) return;
    const schedule = () => {
      const delay = 55_000 + Math.random() * 35_000;
      return window.setTimeout(() => {
        setBirdTop(`${8 + Math.random() * 18}%`);
        setBirdKey((k) => k + 1);
      }, delay);
    };
    let id = window.setTimeout(() => setBirdKey((k) => k + 1), 12_000);
    const onIter = () => { window.clearTimeout(id); id = schedule(); };
    // Re-schedule using animationend fallback via interval on birdKey change effect below.
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => {
      setBirdTop(`${8 + Math.random() * 18}%`);
      setBirdKey((k) => k + 1);
    }, 70_000);
    return () => window.clearTimeout(id);
  }, [birdKey, reduced]);

  const [stampDate, setStampDate] = useState("");
  useEffect(() => {
    try {
      setStampDate(
        new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          .format(new Date()).toUpperCase()
      );
    } catch { /* noop */ }
  }, []);

  return (
    <SiteLayout>
      {departing && <div className="sunrise-wipe" aria-hidden />}

      {/* ═══ CHAPTER 01 — DREAM (Hero) ═══════════════════════════ */}
      <section
        ref={heroRef}
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

          <div className="absolute inset-0 bg-gradient-to-b from-brand-ink/85 via-brand-navy/40 to-brand-ink/70" />

          <div
            aria-hidden
            className="absolute -top-24 -left-24 h-[85%] w-[75%] blur-3xl light-beam"
            style={{ background: "radial-gradient(60% 40% at 30% 30%, color-mix(in oklab, var(--brand-sunrise) 60%, transparent), transparent 70%)" }}
          />
          <div
            aria-hidden
            className="absolute -bottom-40 -right-32 h-[75%] w-[65%] blur-3xl aurora-drift"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--brand-teal) 55%, transparent), transparent 70%)" }}
          />

          {/* Ocean sheen (§2) */}
          <div aria-hidden className="water-shimmer-hero" />

          {/* Ultra-wide compass detail */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] 2xl:block"
            style={{ background: "radial-gradient(60% 55% at 70% 55%, color-mix(in oklab, var(--brand-navy) 45%, transparent), transparent 72%)" }}
          />
          <svg
            aria-hidden viewBox="0 0 800 800"
            className="pointer-events-none absolute -right-24 top-1/2 hidden h-[42rem] w-[42rem] -translate-y-1/2 opacity-[0.09] 2xl:block"
            fill="none"
          >
            <circle cx="400" cy="400" r="360" stroke="white" strokeWidth="0.6" strokeDasharray="2 6" />
            <circle cx="400" cy="400" r="240" stroke="white" strokeWidth="0.6" />
            <path d="M60,540 C220,300 480,220 740,320" stroke="var(--brand-sunrise)" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="740" cy="320" r="3" fill="var(--brand-sunrise)" />
            <circle cx="60" cy="540" r="3" fill="white" />
          </svg>

          <div aria-hidden className="absolute inset-0 mist-a" />
          <div aria-hidden className="absolute inset-0 mist-b" />
          <div aria-hidden className="absolute inset-0 dust-motes" />

          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_25%,transparent_38%,oklch(0.09_0.03_245/0.65)_100%)]" />
          <div className="absolute inset-0 grain" aria-hidden />

          {/* Bird — one silhouette at a time (§2, §7 #9) */}
          {!reduced && (
            <svg
              key={birdKey}
              aria-hidden
              className="pointer-events-none absolute z-10 h-3 w-6 bird-glide"
              style={{ top: birdTop, left: 0 }}
              viewBox="0 0 24 12"
            >
              <path d="M1 8 Q6 1 12 6 Q18 1 23 8" stroke="white" strokeWidth="0.9" fill="none" opacity="0.7" strokeLinecap="round" />
            </svg>
          )}

          {/* Cursor bloom */}
          {!reduced && <div ref={cursorRef} className="cursor-bloom" style={{ opacity: 0 }} aria-hidden />}
        </div>

        {/* Corner marks */}
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

            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-10 max-w-2xl">
              <div
                className={cn(
                  "group relative rounded-[28px] p-[1.5px] transition-all duration-500",
                  focused || prompt
                    ? "bg-[conic-gradient(from_180deg,var(--brand-coral),var(--brand-sunrise),var(--brand-teal),var(--brand-coral))] shadow-[0_40px_120px_-30px_oklch(0_0_0/0.65)]"
                    : "bg-gradient-to-br from-white/25 via-white/10 to-white/5 shadow-[0_30px_90px_-30px_oklch(0_0_0/0.6)]",
                )}
              >
                <div className="rounded-[calc(28px-1.5px)] bg-brand-ink/60 backdrop-blur-2xl">
                  <div className="flex items-start gap-3 p-4 md:p-5">
                    <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-coral to-brand-sunrise text-white shadow-[var(--shadow-coral)]">
                      <Sparkles className="h-4 w-4" />
                    </span>

                    <label className="sr-only" htmlFor="landing-prompt">Describe your trip</label>
                    <div className="relative flex-1">
                      <textarea
                        id="landing-prompt" ref={taRef} value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                        rows={1}
                        aria-label="Describe your trip"
                        placeholder=" "
                        className="min-h-[2.75rem] w-full resize-none bg-transparent py-1.5 text-[17px] leading-snug text-white outline-none md:text-[19px]"
                      />
                      {!prompt && !focused && (
                        <span aria-hidden className="pointer-events-none absolute inset-0 py-1.5 text-[17px] leading-snug text-white/45 md:text-[19px]">
                          {ghostText}
                          <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] rounded-full bg-brand-sunrise caret-blink align-middle" />
                        </span>
                      )}
                    </div>

                    <button
                      type="submit" aria-label="Begin journey"
                      className="press focus-ring-hero mt-0.5 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-white px-4 text-sm font-medium text-brand-ink shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl md:h-12 md:px-5"
                    >
                      Begin <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-white/10 px-3 py-2.5 text-[11px] text-white/60 sm:flex sm:flex-wrap sm:justify-between sm:px-4">
                    <div className="flex min-w-0 items-center gap-1">
                      <button type="button" aria-label="Voice input" className="press focus-ring-hero inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                        <Mic className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label="Attach itinerary or photo" className="press focus-ring-hero inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                        <Paperclip className="h-3.5 w-3.5" />
                      </button>
                      <span className="mx-1 hidden h-4 w-px bg-white/15 sm:inline-block" />
                      <span className="hidden items-center gap-1.5 truncate font-mono uppercase tracking-[0.18em] sm:inline-flex">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-brand-mint" />
                        Grounded · Weather-aware · Visa-aware
                      </span>
                    </div>
                    <span className="hidden items-center gap-1 whitespace-nowrap font-mono min-[380px]:inline-flex">
                      <Command className="h-3 w-3" />⏎ to begin
                    </span>
                  </div>
                </div>
              </div>

              {/* Live intelligence strip (§5) */}
              <div className="mt-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/60" aria-live="polite">
                <span className="h-1 w-1 rounded-full bg-brand-mint animate-pulse" aria-hidden />
                <span key={intelIdx} className="rise-in truncate">{liveIntel[intelIdx]}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {prompts.slice(0, 4).map((p, i) => (
                  <button
                    key={p} type="button" onClick={() => submit(p)}
                    style={{ animationDelay: `${400 + i * 120}ms` }}
                    className="rise-in focus-ring-hero rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs text-white/80 backdrop-blur transition hover:-translate-y-0.5 hover:border-brand-coral/50 hover:bg-white/10 hover:text-white"
                  >
                    "{p.length > 62 ? p.slice(0, 60) + "…" : p}"
                  </button>
                ))}
              </div>
            </form>
          </div>
        </Container>

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

      <ChapterDivider n="02" word="Discover" tone="ink" />

      {/* ═══ CHAPTER 02 — DISCOVER (marquee) ═════════════════════ */}
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

      <ChapterDivider n="03" word="Imagine" tone="linen" />

      {/* ═══ CHAPTER 03 — IMAGINE (Living Postcards §1, §4) ═════ */}
      <section className="relative border-b border-border/60 bg-brand-linen py-24 md:py-32">
        <Container>
          <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Six chapters</p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-[-0.025em] sm:text-5xl md:text-6xl max-w-xl">
                The world, told as
                <span className="font-editorial text-brand-coral"> stories</span>.
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Hover a card and the place returns your gaze. Tap it and the
              Studio drafts the trip — day by day, real activities, real budget.
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
                  className={`focus-ring-hero group relative overflow-hidden rounded-[1.75rem] bg-muted text-left ring-1 ring-border/50 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:aurora-ring hover:ring-brand-coral/40 ${span}`}
                  style={{ contentVisibility: "auto" }}
                >
                  <img
                    src={c.img}
                    alt={`${c.name}, ${c.country}`}
                    loading={i < 2 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover transition-all duration-[6000ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.075] group-hover:saturate-[0.94] group-hover:contrast-[1.06]"
                  />
                  {/* Gradients */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-brand-ink/25 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-brand-ink/40 via-transparent to-transparent" />

                  {/* The Living Postcard — environmental layer (§1, §4) */}
                  <DestinationEnv env={c.env} reduced={reduced} />

                  {/* Coral hairline igniting on hover (§1 step 1) */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-brand-coral to-transparent transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
                  />

                  {/* Top row — coord stamp rotates in like a magazine callout (§1 step 2) */}
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5 sm:p-6">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-white/85 backdrop-blur">
                      {c.tag}
                    </span>
                    <span className="hidden rounded-full bg-black/25 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-white/70 backdrop-blur transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[6deg] sm:inline-flex">
                      {c.coord}
                    </span>
                  </div>

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

                    {/* Editorial caption revealed on hover (§1 step 2) */}
                    <p className="mt-2 max-h-0 overflow-hidden font-mono text-[10px] uppercase tracking-[0.24em] text-brand-sunrise/85 opacity-0 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:max-h-6 group-hover:opacity-100 group-focus-visible:max-h-6 group-focus-visible:opacity-100">
                      — {c.caption}
                    </p>

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

                    {/* AI reason footnote (§5) */}
                    <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                      {c.reason}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Container>
      </section>

      <ChapterDivider n="04" word="Plan" tone="linen" />

      {/* ═══ CHAPTER 04 — PLAN (editorial letter) ═══════════════ */}
      <section className="relative py-24 md:py-32">
        <Container>
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-20">
            <div>
              <p className="eyebrow">Why we built it</p>
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
                — Observed by the Studio, {stampDate}
              </p>
            </div>
          </div>
        </Container>
      </section>

      <ChapterDivider n="05" word="Prepare" tone="linen" />

      {/* ═══ CHAPTER 05 — PREPARE (capabilities) ════════════════ */}
      <section className="py-24 md:py-32">
        <Container>
          <div className="grid gap-14 md:grid-cols-[1fr_2fr] md:gap-24">
            <div className="md:sticky md:top-28 md:self-start">
              <p className="eyebrow">Under the hood</p>
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
                    <div className="mt-3 flex items-center gap-2">
                      <span aria-hidden className="inline-block h-px w-8 origin-left scale-x-0 bg-brand-coral/60 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
                        {c.footnote}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="mt-2 hidden h-5 w-5 text-muted-foreground transition-all group-hover:text-brand-coral md:block" />
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <ChapterDivider n="06" word="Travel" tone="ink" />

      {/* ═══ CHAPTER 06 — TRAVEL (testimonial) ══════════════════ */}
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
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">
              — transcribed by the companion
            </p>
          </div>
        </Container>
      </section>

      <ChapterDivider n="07" word="Remember" tone="ink" />

      {/* ═══ CHAPTER 07 — REMEMBER (new, closing) ═══════════════ */}
      <section className="relative overflow-hidden bg-black py-28 text-white md:py-36">
        <div aria-hidden className="absolute inset-0 starfield opacity-70" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black" />
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <svg
              viewBox="0 0 200 200"
              className="mx-auto h-28 w-28 text-brand-coral stamp-draw"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden
            >
              <circle cx="100" cy="100" r="88" />
              <circle cx="100" cy="100" r="74" strokeDasharray="3 4" opacity="0.65" />
              <path d="M55 110 L145 110" strokeWidth="0.8" opacity="0.5" />
              <text x="100" y="96" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="currentColor" stroke="none" letterSpacing="2">EASY TRIP</text>
              <text x="100" y="128" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="currentColor" stroke="none" letterSpacing="1.5">MEMORY · ISSUED</text>
            </svg>
            <p className="mt-8 font-editorial text-2xl italic leading-relaxed text-white/85 sm:text-3xl md:text-4xl">
              Every great trip becomes a memory.
              <span className="block text-brand-sunrise">We just help you get there first.</span>
            </p>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">
              <time dateTime={new Date().toISOString().slice(0, 10)}>{stampDate}</time>
              {" · "}issued by Easy Trip
            </p>
          </div>
        </Container>
      </section>

      <ChapterDivider n="08" word="Begin" tone="linen" />

      {/* ═══ CHAPTER 08 — BEGIN (final invitation) ══════════════ */}
      <section className="relative py-28 md:py-36">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span aria-hidden className="mx-auto block h-px w-40 rule-editorial" />
            <h2 className="mt-8 font-display text-5xl leading-[1] tracking-[-0.03em] sm:text-6xl md:text-7xl">
              Your next trip is
              <span className="block font-editorial text-brand-coral">one sentence away.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground">
              Describe a place you've always imagined. Save trips as you go.
              The Studio remembers how you travel — and gets sharper every journey.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => submit()}
                className="press focus-ring-hero inline-flex h-12 items-center gap-2 rounded-full bg-brand-ink px-6 text-sm font-medium text-white shadow-[var(--shadow-2)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-3)]"
              >
                Describe a place you've always imagined <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/auth"
                className="press inline-flex h-12 items-center gap-2 rounded-full border border-border bg-transparent px-6 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-brand-coral/50 hover:text-brand-coral"
              >
                <PlayCircle className="h-4 w-4" /> Save your journeys
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </SiteLayout>
  );
}
