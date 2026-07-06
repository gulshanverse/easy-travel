import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight, Loader2, User as UserIcon } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Easy Trip" },
      { name: "description", content: "Sign in or create your Easy Trip account." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  component: AuthPage,
});

function isSafeRedirect(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function AuthPage() {
  const { redirect: redirectParam, mode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(mode ?? "signin");
  const [busy, setBusy] = useState<null | "signin" | "signup" | "google" | "forgot">(null);
  const safeRedirect = isSafeRedirect(redirectParam) ?? "/dashboard";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: safeRedirect, replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, safeRedirect]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy("signin");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Welcome back.");
    navigate({ to: safeRedirect, replace: true });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const display_name = String(form.get("name") ?? "").trim();
    setBusy("signup");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { display_name, full_name: display_name },
      },
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox to verify your email.");
    setTab("signin");
  }

  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setBusy("forgot");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent.");
    setTab("signin");
  }

  async function handleGoogle() {
    setBusy("google");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(null);
      toast.error(result.error.message ?? "Google sign-in failed.");
      return;
    }
    if (result.redirected) return; // browser navigates away
    setBusy(null);
    navigate({ to: safeRedirect, replace: true });
  }

  return (
    <SiteLayout>
      <Container className="py-20 md:py-28 grid place-items-center">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 md:p-10 shadow-sm">
          <h1 className="font-display text-4xl">
            {tab === "signin" && "Welcome back."}
            {tab === "signup" && "Start your journey."}
            {tab === "forgot" && "Reset your password."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "signin" && "Sign in to continue planning."}
            {tab === "signup" && "Free forever — save trips and sync across devices."}
            {tab === "forgot" && "We'll email you a secure link to set a new password."}
          </p>

          {tab !== "forgot" ? (
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-8">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleSignIn} className="grid gap-4">
                  <Field id="signin-email" name="email" type="email" label="Email" icon={<Mail className="h-3.5 w-3.5" />} required />
                  <Field id="signin-password" name="password" type="password" label="Password" icon={<Lock className="h-3.5 w-3.5" />} required minLength={8} />
                  <div className="flex justify-end -mt-2">
                    <button type="button" onClick={() => setTab("forgot")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
                      Forgot password?
                    </button>
                  </div>
                  <SubmitButton busy={busy === "signin"}>Sign in</SubmitButton>
                </form>
                <Divider />
                <GoogleButton busy={busy === "google"} onClick={handleGoogle} />
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignUp} className="grid gap-4">
                  <Field id="signup-name" name="name" type="text" label="Full name" icon={<UserIcon className="h-3.5 w-3.5" />} required />
                  <Field id="signup-email" name="email" type="email" label="Email" icon={<Mail className="h-3.5 w-3.5" />} required />
                  <Field id="signup-password" name="password" type="password" label="Password" icon={<Lock className="h-3.5 w-3.5" />} required minLength={8} placeholder="At least 8 characters" />
                  <SubmitButton busy={busy === "signup"}>Create account</SubmitButton>
                </form>
                <Divider />
                <GoogleButton busy={busy === "google"} onClick={handleGoogle} />
              </TabsContent>
            </Tabs>
          ) : (
            <form onSubmit={handleForgot} className="mt-8 grid gap-4">
              <Field id="forgot-email" name="email" type="email" label="Email" icon={<Mail className="h-3.5 w-3.5" />} required />
              <SubmitButton busy={busy === "forgot"}>Send reset link</SubmitButton>
              <button type="button" onClick={() => setTab("signin")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
                Back to sign in
              </button>
            </form>
          )}

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

function Field({
  id, name, type, label, icon, required, minLength, placeholder,
}: {
  id: string; name: string; type: string; label: string; icon: React.ReactNode;
  required?: boolean; minLength?: number; placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        <span className="inline-flex items-center gap-1.5">{icon} {label}</span>
      </Label>
      <Input id={id} name={name} type={type} required={required} minLength={minLength} placeholder={placeholder} autoComplete={
        type === "password" ? (name === "password" ? "current-password" : "new-password") : type === "email" ? "email" : "name"
      } />
    </div>
  );
}

function SubmitButton({ children, busy }: { children: React.ReactNode; busy: boolean }) {
  return (
    <Button size="lg" type="submit" disabled={busy} className="rounded-full mt-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>{children} <ArrowRight className="ml-1 h-4 w-4" /></>)}
    </Button>
  );
}

function Divider() {
  return (
    <div className="relative my-4 text-center text-xs text-muted-foreground">
      <span className="bg-card px-2 relative z-10">or continue with</span>
      <span className="absolute left-0 right-0 top-1/2 h-px bg-border" />
    </div>
  );
}

function GoogleButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" type="button" disabled={busy} onClick={onClick} className="rounded-full w-full">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Google"}
    </Button>
  );
}
