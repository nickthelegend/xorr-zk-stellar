"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { short } from "@/lib/format";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Privy is the sign-in: one button opens Privy's modal (Google · X · email),
// authenticates the user, and provisions an embedded Stellar wallet. The wallet
// provider then derives the user's shielded identity so they can claim.
export function SignInButton() {
  if (!APP_ID) return null; // Privy not configured
  return <PrivySignIn />;
}

function PrivySignIn() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) return <div className="h-9 w-20 rounded-xl bg-white/5 animate-pulse" aria-hidden />;

  if (authenticated) {
    const who =
      user?.email?.address ||
      user?.google?.email ||
      (user?.twitter?.username ? `@${user.twitter.username}` : null) ||
      user?.github?.email ||
      "account";
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline font-mono text-[11px] text-primary/80 truncate max-w-[150px]" title={who}>
          {who.includes("@") ? who : short(who)}
        </span>
        <Button variant="outline" onClick={() => logout()} className="h-9 text-xs">Sign out</Button>
      </div>
    );
  }

  return (
    <Button onClick={() => login()} className="h-9 text-xs font-mono uppercase tracking-widest">
      Sign in
    </Button>
  );
}
