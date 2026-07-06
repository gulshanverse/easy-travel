import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/hotels")({
  head: () => ({
    meta: [
      { title: "Hotels — Easy Trip" },
      { name: "description", content: "Boutique stays, resorts, and city hotels — searched and compared for you." },
      { property: "og:url", content: "/hotels" },
    ],
    links: [{ rel: "canonical", href: "/hotels" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Hotels"
      title="Stays that feel like home away from home."
      description="From boutique hideaways to family resorts — filtered by what actually matters to you."
    />
  ),
});
