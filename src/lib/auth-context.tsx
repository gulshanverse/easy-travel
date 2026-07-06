import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "moderator" | "user";

export type Profile = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_city: string | null;
  home_country: string | null;
  locale: string;
  currency: string;
  timezone: string;
  marketing_opt_in: boolean;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const [{ data: profileRow }, { data: rolesRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((profileRow as Profile | null) ?? null);
    setRoles(((rolesRows ?? []) as { role: AppRole }[]).map((r) => r.role));
  }, []);

  const applySession = useCallback(
    async (next: Session | null) => {
      setSession(next);
      const nextUserId = next?.user?.id ?? null;
      if (nextUserId !== currentUserId.current) {
        currentUserId.current = nextUserId;
        if (nextUserId) {
          await loadProfile(nextUserId);
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    },
    [loadProfile],
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      applySession(data.session).finally(() => mounted && setIsLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      applySession(next);
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession, router, queryClient]);

  const refreshProfile = useCallback(async () => {
    if (currentUserId.current) await loadProfile(currentUserId.current);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isAuthenticated: !!session?.user,
      isLoading,
      hasRole: (r) => roles.includes(r),
      hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
      refreshProfile,
      signOut,
    }),
    [session, profile, roles, isLoading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
