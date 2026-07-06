import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/_authenticated/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — Easy Trip" },
      { name: "description", content: "Save places, stays, and experiences to plan later." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/wishlist" },
    ],
    links: [{ rel: "canonical", href: "/wishlist" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Wishlist"
      title="For the trips you'll take next."
      description="Save destinations, restaurants, and stays that caught your eye — we'll suggest the perfect time to go."
    />
  ),
});
