/**
 * Journey Studio — reusable card primitives.
 * All cards are presentational; behaviour lives in parent panels.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Plane, Hotel, Utensils, Bus, StickyNote, MapPin, Wallet, CloudSun,
  AlertTriangle, Sparkles, Backpack, Route as RouteIcon, Compass, Loader2,
} from "lucide-react";
import type { ActivityKind, StudioActivity } from "../state/StudioContext";

// ---------- Shell ----------
export function StudioCard({
  children, className, tone = "default", interactive = false, onClick, ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "accent" | "danger";
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const toneCls =
    tone === "muted" ? "bg-muted/40 border-border/60"
    : tone === "accent" ? "bg-accent/10 border-accent/40"
    : tone === "danger" ? "bg-destructive/5 border-destructive/40"
    : "bg-card border-border";
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      aria-label={ariaLabel}
      className={cn(
        "rounded-2xl border p-4 transition-all",
        toneCls,
        interactive && "cursor-pointer hover:shadow-md hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ icon, title, meta, right }: { icon?: ReactNode; title: string; meta?: string; right?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
          {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ---------- Activity ----------
const activityIcon: Record<ActivityKind, ReactNode> = {
  flight: <Plane className="h-4 w-4" />,
  hotel: <Hotel className="h-4 w-4" />,
  restaurant: <Utensils className="h-4 w-4" />,
  transport: <Bus className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />,
  activity: <Compass className="h-4 w-4" />,
};

function fmtMoney(cents?: number, ccy = "USD") {
  if (typeof cents !== "number") return null;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(0)} ${ccy}`; }
}

export function ActivityCard({
  activity, selected, onSelect, onRemove, draggable = true, onDragStart, onDragEnd,
}: {
  activity: StudioActivity;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const money = fmtMoney(activity.costCents, activity.currency);
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex items-start gap-3 rounded-xl border bg-card p-3 transition-all",
        selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
      )}
      onClick={onSelect}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80">
        {activityIcon[activity.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{activity.title}</p>
          {activity.startTime && <span className="text-xs text-muted-foreground">{activity.startTime}</span>}
        </div>
        {activity.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{activity.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {activity.location && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{activity.location}</span>
          )}
          {activity.durationMinutes ? <span>{activity.durationMinutes}m</span> : null}
          {money && <span className="font-medium text-foreground/80">{money}</span>}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${activity.title}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive transition"
        >
          Remove
        </button>
      )}
    </div>
  );
}

// ---------- Timeline / Journey ----------
export function TimelineCard({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition",
        active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function JourneyCard({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <StudioCard>
      <CardHeader icon={<RouteIcon className="h-4 w-4" />} title={title} meta={subtitle} right={right} />
    </StudioCard>
  );
}

// ---------- Intelligence cards ----------
export function BudgetCard({ totalCents, currency, spentCents = 0 }: { totalCents: number | null; currency: string; spentCents?: number }) {
  const pct = totalCents ? Math.min(100, Math.round((spentCents / totalCents) * 100)) : 0;
  return (
    <StudioCard>
      <CardHeader icon={<Wallet className="h-4 w-4" />} title="Budget" meta={totalCents ? `${fmtMoney(spentCents, currency)} of ${fmtMoney(totalCents, currency)}` : "Not set"} />
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </StudioCard>
  );
}

export function WeatherCard({ location, summary, tempC }: { location?: string; summary?: string; tempC?: number }) {
  return (
    <StudioCard>
      <CardHeader icon={<CloudSun className="h-4 w-4" />} title={location ?? "Weather"} meta={summary ?? "Add a destination to see forecast"} right={tempC != null ? <span className="text-sm font-medium">{Math.round(tempC)}°</span> : null} />
    </StudioCard>
  );
}

export function RiskCard({ severity, title, message }: { severity: "low" | "medium" | "high"; title: string; message: string }) {
  const tone = severity === "high" ? "danger" : severity === "medium" ? "accent" : "muted";
  return (
    <StudioCard tone={tone}>
      <CardHeader icon={<AlertTriangle className="h-4 w-4" />} title={title} meta={severity.toUpperCase()} />
      <p className="mt-2 text-xs text-muted-foreground">{message}</p>
    </StudioCard>
  );
}

export function RecommendationCard({ title, reason, confidence, onAdd }: { title: string; reason: string; confidence: number; onAdd?: () => void }) {
  return (
    <StudioCard interactive={!!onAdd} onClick={onAdd} ariaLabel={`Add recommendation ${title}`}>
      <CardHeader
        icon={<Sparkles className="h-4 w-4" />}
        title={title}
        meta={`${Math.round(confidence * 100)}% match`}
        right={onAdd ? <span className="text-xs text-primary">+ Add</span> : null}
      />
      <p className="mt-2 text-xs text-muted-foreground">{reason}</p>
    </StudioCard>
  );
}

export function PackingCard({ items }: { items: string[] }) {
  return (
    <StudioCard>
      <CardHeader icon={<Backpack className="h-4 w-4" />} title="Packing suggestions" meta={`${items.length} items`} />
      <ul className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-muted-foreground/60" />{it}</li>
        ))}
      </ul>
    </StudioCard>
  );
}

export function MapCard({ destination }: { destination: string | null }) {
  return (
    <StudioCard tone="muted" className="p-0 overflow-hidden">
      <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-primary/10 via-background to-accent/20">
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <MapPin className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-2 text-sm font-medium">{destination ?? "Choose a destination"}</p>
            <p className="text-xs text-muted-foreground">Interactive map coming soon</p>
          </div>
        </div>
      </div>
    </StudioCard>
  );
}

export function FlightCard({ from, to, time }: { from?: string; to?: string; time?: string }) {
  return (
    <StudioCard>
      <CardHeader icon={<Plane className="h-4 w-4" />} title={`${from ?? "Origin"} → ${to ?? "Destination"}`} meta={time ?? "Add flight details"} />
    </StudioCard>
  );
}

export function HotelCard({ name, nights }: { name?: string; nights?: number }) {
  return (
    <StudioCard>
      <CardHeader icon={<Hotel className="h-4 w-4" />} title={name ?? "Accommodation"} meta={nights ? `${nights} nights` : "Add stay"} />
    </StudioCard>
  );
}

export function AIThinkingCard({ message }: { message: string }) {
  return (
    <StudioCard tone="accent">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm text-foreground/80">{message}</p>
      </div>
    </StudioCard>
  );
}
