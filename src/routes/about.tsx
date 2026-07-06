import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Easy Trip" },
      { name: "description", content: "We're building the travel companion we always wanted." },
      { property: "og:title", content: "About — Easy Trip" },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <SiteLayout>
      <PageHeader
        eyebrow="About"
        title="Travel deserves better software."
        description="We're a small team of engineers, designers, and lifelong travelers building the AI travel companion we always wished existed."
      />
      <Container className="pb-24 grid gap-16 lg:grid-cols-3">
        {[
          { h: "Our mission", p: "Make travel planning feel like a conversation with a well-traveled friend — one who happens to remember every flight, hotel, and hidden restaurant on Earth." },
          { h: "Our approach", p: "AI grounded in real data. Every recommendation ties back to real inventory, real prices, and real reviews. Beauty, but never fiction." },
          { h: "Our promise", p: "No dark patterns. Clear pricing. Human support. A tool that respects your time and your money." },
        ].map((s) => (
          <div key={s.h}>
            <h2 className="font-display text-3xl">{s.h}</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">{s.p}</p>
          </div>
        ))}
      </Container>
    </SiteLayout>
  );
}
