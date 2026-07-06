import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/site/ComingSoon";

export const Route = createFileRoute("/trains")({
  head: () => ({
    meta: [
      { title: "Trains — Easy Trip" },
      { name: "description", content: "Book rail journeys across regions with one clear timetable." },
      { property: "og:url", content: "/trains" },
    ],
    links: [{ rel: "canonical", href: "/trains" }],
  }),
  component: () => (
    <ComingSoon
      eyebrow="Trains"
      title="Scenic rail, simplified."
      description="Cross-country routes, high-speed lines, and sleeper cars — searched with one query."
    />
  ),
});
