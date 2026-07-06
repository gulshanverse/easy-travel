import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/cabs")({
  head: () => ({
    meta: [
      { title: "Cabs & Transfers — Easy Trip" },
      { name: "description", content: "Airport transfers and city cabs, pre-booked and confirmed." },
      { property: "og:url", content: "/cabs" },
    ],
    links: [{ rel: "canonical", href: "/cabs" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Cabs"
      title="A ride waiting when you land."
      description="Confirmed transfers, upfront pricing, no scramble at arrivals."
    />
  ),
});
