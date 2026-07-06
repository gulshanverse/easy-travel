import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Journal — Easy Trip" },
      { name: "description", content: "Stories, guides, and inspiration from travelers around the world." },
      { property: "og:url", content: "/blog" },
    ],
    links: [{ rel: "canonical", href: "/blog" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Journal"
      title="Stories from the road."
      description="Long-form guides, city dispatches, and inspiration — from our team and our community."
    />
  ),
});
