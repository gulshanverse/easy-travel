import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Easy Trip" },
      { name: "description", content: "The terms of using Easy Trip." },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: () => (
    <SiteLayout>
      <PageHeader eyebrow="Legal" title="Terms of service." />
      <Container className="pb-24 max-w-3xl text-foreground/85 space-y-4">
        <p>By using Easy Trip you agree to plan and book responsibly. We connect you with airlines, hotels, and experience providers; their terms also apply to those bookings.</p>
        <p>We work hard to keep prices and availability accurate but final confirmation happens at the moment of booking.</p>
        <p>These terms may evolve. Material changes will be communicated in the product.</p>
      </Container>
    </SiteLayout>
  ),
});
