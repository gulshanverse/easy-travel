import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/experiences")({
  head: () => ({
    meta: [
      { title: "Experiences — Easy Trip" },
      { name: "description", content: "Tours, tastings, and once-in-a-lifetime moments — vetted and ready to book." },
      { property: "og:url", content: "/experiences" },
    ],
    links: [{ rel: "canonical", href: "/experiences" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Experiences"
      title="The moments that make the trip."
      description="From private chef dinners to sunrise hikes — hand-picked and instantly bookable."
    />
  ),
});
