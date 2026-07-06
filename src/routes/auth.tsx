import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Easy Trip" },
      { name: "description", content: "Sign in or create your Easy Trip account." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "/auth" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  return (
    <SiteLayout>
      <Container className="py-20 md:py-28 grid place-items-center">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 md:p-10 shadow-sm">
          <h1 className="font-display text-4xl">
            {tab === "signin" ? "Welcome back." : "Start your journey."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "signin"
              ? "Sign in to continue planning."
              : "Free forever — save trips and sync across devices."}
          </p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-8">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            {(["signin", "signup"] as const).map((k) => (
              <TabsContent key={k} value={k} className="mt-6 grid gap-4">
                {k === "signup" && (
                  <div className="grid gap-2">
                    <Label htmlFor={`${k}-name`}>Full name</Label>
                    <Input id={`${k}-name`} placeholder="Jane Traveler" />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor={`${k}-email`}>
                    <Mail className="inline h-3.5 w-3.5 mr-1" /> Email
                  </Label>
                  <Input id={`${k}-email`} type="email" placeholder="you@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${k}-password`}>
                    <Lock className="inline h-3.5 w-3.5 mr-1" /> Password
                  </Label>
                  <Input id={`${k}-password`} type="password" placeholder="••••••••" />
                </div>
                <Button size="lg" className="rounded-full mt-2">
                  {k === "signin" ? "Sign in" : "Create account"}{" "}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <div className="relative my-2 text-center text-xs text-muted-foreground">
                  <span className="bg-card px-2 relative z-10">or continue with</span>
                  <span className="absolute left-0 right-0 top-1/2 h-px bg-border" />
                </div>
                <Button variant="outline" className="rounded-full">
                  Continue with Google
                </Button>
              </TabsContent>
            ))}
          </Tabs>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline underline-offset-4">Terms</Link> and{" "}
            <Link to="/privacy" className="underline underline-offset-4">Privacy</Link>.
          </p>
        </div>
      </Container>
    </SiteLayout>
  );
}
