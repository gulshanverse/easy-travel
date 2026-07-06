import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Easy Trip" },
      { name: "description", content: "Choose a new password for your Easy Trip account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase JS auto-exchanges the recovery link and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <SiteLayout>
      <Container className="py-20 md:py-28 grid place-items-center">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 md:p-10 shadow-sm">
          <h1 className="font-display text-4xl">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ready
              ? "Enter a new password to finish resetting your account."
              : "Waiting for your reset link to be verified…"}
          </p>

          <form onSubmit={onSubmit} className="mt-8 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">
                <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> New password</span>
              </Label>
              <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required disabled={!ready} />
            </div>
            <Button size="lg" type="submit" disabled={!ready || busy} className="rounded-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        </div>
      </Container>
    </SiteLayout>
  );
}
