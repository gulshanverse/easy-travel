import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Send, MapPin, Calendar, Users, Wallet } from "lucide-react";

import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/ai-planner")({
  head: () => ({
    meta: [
      { title: "AI Planner — Easy Trip" },
      {
        name: "description",
        content:
          "Describe your dream trip and get a full AI-generated itinerary — flights, stays, experiences and daily plans.",
      },
      { property: "og:title", content: "AI Planner — Easy Trip" },
      { property: "og:url", content: "/ai-planner" },
    ],
    links: [{ rel: "canonical", href: "/ai-planner" }],
  }),
  component: AiPlannerPage,
});

const prompts = [
  "7-day honeymoon in Bali with private villas",
  "Solo trip through Kyoto in cherry-blossom season",
  "Long weekend in Lisbon under $1,200",
  "Family of 4, Iceland ring road in September",
];

function AiPlannerPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<null | {
    title: string;
    days: { day: number; title: string; items: string[] }[];
  }>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setPlan(null);
    // Simulated generation — real generation wires to Lovable AI Gateway.
    await new Promise((r) => setTimeout(r, 900));
    setPlan({
      title: prompt,
      days: [
        {
          day: 1,
          title: "Arrival & first impressions",
          items: [
            "Airport pickup & check-in to boutique stay",
            "Sunset walk in the old town",
            "Chef's tasting menu at a local favorite",
          ],
        },
        {
          day: 2,
          title: "Culture & landmarks",
          items: [
            "Morning museum with skip-the-line entry",
            "Guided architecture walk",
            "Rooftop cocktails at golden hour",
          ],
        },
        {
          day: 3,
          title: "Nature & escape",
          items: [
            "Half-day drive to a scenic viewpoint",
            "Farm-to-table lunch",
            "Evening jazz at a hidden bar",
          ],
        },
      ],
    });
    setLoading(false);
  };

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="AI Planner"
        title="Describe the trip. We'll build it."
        description="Tell us where you're going, when, with whom, and what you love. Our AI drafts a complete, bookable itinerary."
      />

      <Container className="pb-24 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        {/* Left: form */}
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest font-medium">
              New itinerary
            </span>
          </div>

          <div className="mt-6 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="dest">
                <MapPin className="inline h-4 w-4 mr-1" /> Destination
              </Label>
              <Input id="dest" placeholder="Tokyo, Japan" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dates">
                  <Calendar className="inline h-4 w-4 mr-1" /> Dates
                </Label>
                <Input id="dates" placeholder="Apr 3 – Apr 10" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="travelers">
                  <Users className="inline h-4 w-4 mr-1" /> Travelers
                </Label>
                <Input id="travelers" placeholder="2 adults" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget">
                <Wallet className="inline h-4 w-4 mr-1" /> Budget
              </Label>
              <Input id="budget" placeholder="$3,000 total" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prompt">Tell us what you love</Label>
              <Textarea
                id="prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Boutique stays, walkable neighborhoods, one splurge dinner, morning coffee rituals…"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => setPrompt(p)}
                  className="text-xs rounded-full px-2.5 py-1 border border-border hover:bg-muted transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
            <Button
              onClick={generate}
              disabled={loading || !prompt.trim()}
              size="lg"
              className="rounded-full"
            >
              {loading ? (
                "Crafting your itinerary…"
              ) : (
                <>
                  Generate itinerary <Send className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right: output */}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-muted/60 to-background p-6 md:p-8 min-h-[420px]">
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          )}
          {!loading && !plan && (
            <div className="h-full flex flex-col items-start justify-center gap-3 text-muted-foreground">
              <Sparkles className="h-6 w-6 text-accent" />
              <h3 className="font-display text-2xl text-foreground">
                Your itinerary will appear here.
              </h3>
              <p className="max-w-md text-sm">
                Fill in a few details and press <em>Generate</em>. You can refine
                any day, swap experiences, and export to My Trips.
              </p>
            </div>
          )}
          {plan && (
            <div>
              <h3 className="font-display text-3xl">{plan.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Draft itinerary — refine anything you like.
              </p>
              <ol className="mt-6 space-y-4">
                {plan.days.map((d) => (
                  <li
                    key={d.day}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-2xl text-accent">
                        Day {d.day}
                      </span>
                      <span className="font-medium">{d.title}</span>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                      {d.items.map((i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                          {i}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button className="rounded-full">Save to My Trips</Button>
                <Button variant="outline" className="rounded-full">
                  Export as PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      </Container>
    </SiteLayout>
  );
}
