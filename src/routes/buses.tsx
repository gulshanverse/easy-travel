import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/buses")({
  head: () => ({
    meta: [
      { title: "Buses — Easy Trip" },
      { name: "description", content: "Long-distance and intercity bus routes with transparent fares." },
      { property: "og:url", content: "/buses" },
    ],
    links: [{ rel: "canonical", href: "/buses" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Buses"
      title="The friendliest way to hop between cities."
      description="Compare intercity operators, seat classes, and pickup points side by side."
    />
  ),
});
