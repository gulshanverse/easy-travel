import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Easy Trip" },
      { name: "description", content: "Get help with bookings, refunds, and account questions." },
      { property: "og:url", content: "/support" },
    ],
    links: [{ rel: "canonical", href: "/support" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Support"
      title="Real humans, when you need them."
      description="24/7 support across chat and email — with average response under 4 minutes."
    />
  ),
});
