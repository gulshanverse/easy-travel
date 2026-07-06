import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, MapPin } from "lucide-react";

import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import destTokyo from "@/assets/dest-tokyo.jpg";
import destBali from "@/assets/dest-bali.jpg";
import destIceland from "@/assets/dest-iceland.jpg";
import destMarrakech from "@/assets/dest-marrakech.jpg";
import destDolomites from "@/assets/dest-dolomites.jpg";
import destLisbon from "@/assets/dest-lisbon.jpg";

export const Route = createFileRoute("/destinations")({
  head: () => ({
    meta: [
      { title: "Destinations — Easy Trip" },
      {
        name: "description",
        content:
          "Explore curated destinations around the world. Get AI-crafted itineraries for cities, islands, and hidden corners.",
      },
      { property: "og:title", content: "Destinations — Easy Trip" },
      { property: "og:url", content: "/destinations" },
    ],
    links: [{ rel: "canonical", href: "/destinations" }],
  }),
  component: DestinationsPage,
});

const items = [
  { name: "Tokyo", country: "Japan", region: "Asia", img: destTokyo, tag: "City", nights: "5–7", from: "$1,240" },
  { name: "Bali", country: "Indonesia", region: "Asia", img: destBali, tag: "Island", nights: "7–10", from: "$980" },
  { name: "Reykjavik", country: "Iceland", region: "Europe", img: destIceland, tag: "Nature", nights: "4–6", from: "$1,540" },
  { name: "Marrakech", country: "Morocco", region: "Africa", img: destMarrakech, tag: "Culture", nights: "4–5", from: "$860" },
  { name: "Dolomites", country: "Italy", region: "Europe", img: destDolomites, tag: "Adventure", nights: "5–7", from: "$1,120" },
  { name: "Lisbon", country: "Portugal", region: "Europe", img: destLisbon, tag: "City", nights: "4–6", from: "$720" },
];

const filters = ["All", "City", "Island", "Nature", "Culture", "Adventure"];

function DestinationsPage() {
  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Destinations"
        title="Places worth going to."
        description="A living atlas of destinations, hand-picked and continuously refined by our AI and by travelers like you."
      />

      <Container className="pb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10 h-12 rounded-full bg-card"
              placeholder="Search cities, countries, vibes…"
              aria-label="Search destinations"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((f, i) => (
              <button
                key={f}
                className={
                  "rounded-full px-4 py-2 text-sm border transition-colors " +
                  (i === 0
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted")
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </Container>

      <Container className="pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((d) => (
            <article
              key={d.name}
              className="group rounded-2xl overflow-hidden border border-border bg-card flex flex-col"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={d.img}
                  alt={`${d.name}, ${d.country}`}
                  width={1200}
                  height={900}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <Badge className="absolute top-3 left-3 bg-white/95 text-brand-navy hover:bg-white">
                  {d.tag}
                </Badge>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-2xl">{d.name}</h3>
                  <span className="text-xs text-muted-foreground">{d.region}</span>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" /> {d.country}
                </p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{d.nights} nights</span>
                  <span className="text-foreground font-medium">
                    from <span className="font-display text-lg">{d.from}</span>
                  </span>
                </div>
                <Button asChild variant="outline" className="mt-5 rounded-full">
                  <Link to="/ai-planner">Plan a trip</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </SiteLayout>
  );
}
