import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Easy Trip" },
      { name: "description", content: "Your travel dashboard." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/dashboard" },
    ],
    links: [{ rel: "canonical", href: "/dashboard" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Dashboard"
      title="Your trips at a glance."
      description="Upcoming journeys, planning drafts, and travel insights — organized for you."
    />
  ),
});
