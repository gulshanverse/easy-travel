import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Send } from "lucide-react";

import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Easy Trip" },
      { name: "description", content: "Say hello, share feedback, or get in touch with the Easy Trip team." },
      { property: "og:title", content: "Contact — Easy Trip" },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Contact"
        title="Let's talk travel."
        description="Have a question, an idea, or a partnership in mind? We read every message."
      />
      <Container className="pb-24 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-3xl border border-border bg-card p-8 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-medium">
              Reach us
            </p>
            <div className="mt-3 flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4" /> hello@easytrip.app
            </div>
            <div className="mt-2 flex items-center gap-2 text-foreground">
              <MapPin className="h-4 w-4" /> Remote-first, everywhere our travelers go
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <h3 className="font-display text-xl">Media & partnerships</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              partnerships@easytrip.app
            </p>
          </div>
        </div>
        <form
          className="rounded-3xl border border-border bg-card p-8 space-y-5"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Your name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" rows={6} placeholder="Tell us what's on your mind…" />
          </div>
          <Button type="submit" size="lg" className="rounded-full">
            Send message <Send className="ml-1 h-4 w-4" />
          </Button>
        </form>
      </Container>
    </SiteLayout>
  );
}
