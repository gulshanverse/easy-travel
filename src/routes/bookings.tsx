import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — Easy Trip" },
      { name: "description", content: "Manage your confirmed bookings and receipts." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/bookings" },
    ],
    links: [{ rel: "canonical", href: "/bookings" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Bookings"
      title="Confirmed. Organized. Ready."
      description="All your reservations, receipts, and cancellation windows — in one calm view."
    />
  ),
});
