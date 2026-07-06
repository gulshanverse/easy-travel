import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Easy Trip" },
      { name: "description", content: "Manage your Easy Trip account and preferences." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/settings" },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Settings"
      title="Tuned to how you travel."
      description="Preferences, notifications, currency, and privacy controls — all in one place."
    />
  ),
});
