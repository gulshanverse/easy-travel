import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Payments — Easy Trip" },
      { name: "description", content: "Secure payments and refund tracking." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/payments" },
    ],
    links: [{ rel: "canonical", href: "/payments" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Payments"
      title="Secure. Transparent. Fast."
      description="Multiple payment methods, saved cards, and clear refund tracking — with bank-grade encryption."
    />
  ),
});
