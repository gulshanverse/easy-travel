import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/flights")({
  head: () => ({
    meta: [
      { title: "Flights — Easy Trip" },
      { name: "description", content: "Compare flights across airlines with transparent pricing." },
      { property: "og:url", content: "/flights" },
    ],
    links: [{ rel: "canonical", href: "/flights" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Flights"
      title="Compare flights. Skip the noise."
      description="Live prices from every major airline, side-by-side, with baggage and cancellation clearly labeled."
    />
  ),
});
