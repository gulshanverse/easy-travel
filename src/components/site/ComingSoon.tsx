import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, SiteLayout } from "./SiteLayout";
import { Sparkles } from "lucide-react";

export function ComingSoon({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <SiteLayout>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="container-page pb-24">
        <div className="rounded-3xl border border-border bg-card p-10 md:p-16 flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" /> In active development
          </span>
          <p className="max-w-2xl text-muted-foreground">
            We're crafting this experience with the same care you'll feel across
            Easy Trip. In the meantime, start with our AI Planner — it already
            knows how to weave flights, stays, and experiences into one itinerary.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/ai-planner">Open AI Planner</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/destinations">Browse destinations</Link>
            </Button>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
