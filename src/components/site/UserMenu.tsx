import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, MapPin, Heart, Ticket, Settings as SettingsIcon, User as UserIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.split("@")[0] || "?").trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function UserMenu() {
  const { isAuthenticated, isLoading, user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return <div className="h-9 w-24 rounded-md bg-muted animate-pulse" aria-hidden />;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/auth" search={{ mode: "signup" }}>Get started</Link>
        </Button>
      </div>
    );
  }

  const name = profile?.display_name ?? profile?.full_name ?? user?.email ?? "Account";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-muted transition-colors" aria-label="Account menu">
          <Avatar className="h-8 w-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback>{initials(name, user?.email)}</AvatarFallback>
          </Avatar>
          <span className="hidden md:inline text-sm max-w-[10rem] truncate">{name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/my-trips"><MapPin className="mr-2 h-4 w-4" /> My trips</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/wishlist"><Heart className="mr-2 h-4 w-4" /> Wishlist</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/bookings"><Ticket className="mr-2 h-4 w-4" /> Bookings</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/settings"><SettingsIcon className="mr-2 h-4 w-4" /> Settings</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/settings" hash="profile"><UserIcon className="mr-2 h-4 w-4" /> Profile</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
