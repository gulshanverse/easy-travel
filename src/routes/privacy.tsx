import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Easy Trip" },
      { name: "description", content: "How Easy Trip handles your data." },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: () => (
    <SiteLayout>
      <PageHeader eyebrow="Legal" title="Privacy at Easy Trip." />
      <Container className="pb-24 prose prose-neutral max-w-3xl text-foreground/85">
        <p>
          This page is maintained by the Easy Trip team to describe how we handle
          the information you share while planning and booking travel.
        </p>
        <h2 className="font-display text-2xl mt-8">What we collect</h2>
        <p>Only what we need to plan and book your trip: account details, saved itineraries, and booking history.</p>
        <h2 className="font-display text-2xl mt-8">How we use it</h2>
        <p>To personalize recommendations, confirm bookings, and improve our AI. We never sell your data.</p>
        <h2 className="font-display text-2xl mt-8">Your rights</h2>
        <p>Access, export, or delete your data any time from Settings. Reach us at privacy@easytrip.app for questions.</p>
      </Container>
    </SiteLayout>
  ),
});
