import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/restaurants")({
  head: () => ({
    meta: [
      { title: "Restaurants — Easy Trip" },
      { name: "description", content: "Chef-recommended restaurants with real reservations." },
      { property: "og:url", content: "/restaurants" },
    ],
    links: [{ rel: "canonical", href: "/restaurants" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Restaurants"
      title="Book tables that locals actually love."
      description="Reservations at neighborhood gems, tasting menus, and rooftops — filtered by cuisine and mood."
    />
  ),
});
