import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/_authenticated/my-trips")({
  head: () => ({
    meta: [
      { title: "My Trips — Easy Trip" },
      { name: "description", content: "Every itinerary, one place." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/my-trips" },
    ],
    links: [{ rel: "canonical", href: "/my-trips" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="My Trips"
      title="Every itinerary, in one place."
      description="Save AI-generated plans, share with your crew, and pick up planning from any device."
    />
  ),
});
