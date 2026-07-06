import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, KeyRound, User as UserIcon, Globe, Bell } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Container } from "@/components/site/Container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Easy Trip" },
      { name: "description", content: "Manage your Easy Trip profile, preferences, and security." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [draft, setDraft] = useState<Profile | null>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => { if (profile) setDraft(profile); }, [profile]);

  if (!draft) {
    return (
      <SiteLayout>
        <Container className="py-24 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Container>
      </SiteLayout>
    );
  }

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft({ ...draft, [k]: v });

  async function saveProfile() {
    if (!draft) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({
      display_name: draft.display_name,
      full_name: draft.full_name,
      avatar_url: draft.avatar_url,
      bio: draft.bio,
      home_city: draft.home_city,
      home_country: draft.home_country,
      locale: draft.locale,
      currency: draft.currency,
      timezone: draft.timezone,
      marketing_opt_in: draft.marketing_opt_in,
    }).eq("id", draft.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved.");
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPass(false);
    if (error) return toast.error(error.message);
    (e.target as HTMLFormElement).reset();
    toast.success("Password updated.");
  }

  const initials = ((draft.display_name || user?.email || "?").trim()[0] ?? "?").toUpperCase();

  return (
    <SiteLayout>
      <Container className="py-16 md:py-20 max-w-3xl">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</p>
          <h1 className="font-display text-5xl mt-2">Settings</h1>
          <p className="text-muted-foreground mt-3">Signed in as {user?.email}</p>
        </header>

        <Section id="profile" icon={<UserIcon className="h-4 w-4" />} title="Profile">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {draft.avatar_url ? <AvatarImage src={draft.avatar_url} alt={draft.display_name ?? ""} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid gap-2 flex-1">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input id="avatar_url" value={draft.avatar_url ?? ""} onChange={(e) => set("avatar_url", e.target.value || null)} placeholder="https://…" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <FieldRow label="Display name" id="display_name">
              <Input id="display_name" value={draft.display_name ?? ""} onChange={(e) => set("display_name", e.target.value || null)} />
            </FieldRow>
            <FieldRow label="Full name" id="full_name">
              <Input id="full_name" value={draft.full_name ?? ""} onChange={(e) => set("full_name", e.target.value || null)} />
            </FieldRow>
            <FieldRow label="Home city" id="home_city">
              <Input id="home_city" value={draft.home_city ?? ""} onChange={(e) => set("home_city", e.target.value || null)} />
            </FieldRow>
            <FieldRow label="Home country" id="home_country">
              <Input id="home_country" value={draft.home_country ?? ""} onChange={(e) => set("home_country", e.target.value || null)} />
            </FieldRow>
          </div>
          <FieldRow label="Bio" id="bio" className="mt-4">
            <Textarea id="bio" rows={3} value={draft.bio ?? ""} onChange={(e) => set("bio", e.target.value || null)} />
          </FieldRow>
        </Section>

        <Section id="preferences" icon={<Globe className="h-4 w-4" />} title="Regional preferences">
          <div className="grid md:grid-cols-3 gap-4">
            <FieldRow label="Locale" id="locale"><Input id="locale" value={draft.locale} onChange={(e) => set("locale", e.target.value)} /></FieldRow>
            <FieldRow label="Currency" id="currency"><Input id="currency" value={draft.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></FieldRow>
            <FieldRow label="Timezone" id="timezone"><Input id="timezone" value={draft.timezone} onChange={(e) => set("timezone", e.target.value)} /></FieldRow>
          </div>
        </Section>

        <Section id="notifications" icon={<Bell className="h-4 w-4" />} title="Notifications">
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <div className="text-sm font-medium">Product & travel emails</div>
              <div className="text-xs text-muted-foreground">Occasional updates, curated deals, and travel intelligence.</div>
            </div>
            <Switch checked={draft.marketing_opt_in} onCheckedChange={(v) => set("marketing_opt_in", v)} />
          </div>
        </Section>

        <div className="flex justify-end mt-6">
          <Button onClick={saveProfile} disabled={savingProfile} className="rounded-full">
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save changes</>}
          </Button>
        </div>

        <Section id="security" icon={<KeyRound className="h-4 w-4" />} title="Security" className="mt-12">
          <form onSubmit={changePassword} className="grid gap-4 max-w-sm">
            <FieldRow label="New password" id="password">
              <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
            </FieldRow>
            <Button type="submit" disabled={savingPass} variant="outline" className="rounded-full w-fit">
              {savingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-6">
            Multi-factor authentication and passkey/WebAuthn sign-in are on the near-term roadmap.
          </p>
        </Section>
      </Container>
    </SiteLayout>
  );
}

function Section({ id, icon, title, children, className }: {
  id: string; icon: React.ReactNode; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} className={`rounded-3xl border border-border bg-card p-6 md:p-8 mt-8 ${className ?? ""}`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">{icon} {title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function FieldRow({ id, label, children, className }: {
  id: string; label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
