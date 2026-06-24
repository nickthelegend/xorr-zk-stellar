"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { short } from "@/lib/format";

// Compact SSO control for the header. Shows provider options when signed out and
// the identity + sign-out when signed in. The dev-email provider only appears
// when the server enabled it (NEXT_PUBLIC_ALLOW_DEV_LOGIN), for local testing.
const devLogin =
  process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true" ||
  process.env.NODE_ENV !== "production";

export function SignInButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  if (status === "loading") {
    return <div className="h-9 w-20 rounded-xl bg-white/5 animate-pulse" aria-hidden />;
  }

  if (session?.user) {
    const who = session.user.email || session.user.name || "account";
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline font-mono text-[11px] text-primary/80 truncate max-w-[140px]" title={who}>
          {who.includes("@") ? who : short(who)}
        </span>
        <Button variant="outline" onClick={() => signOut()} className="h-9 text-xs">
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((o) => !o)} className="h-9 text-xs font-mono uppercase tracking-widest">
        Sign in
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-primary/20 bg-[#05080f] p-3 shadow-xl z-50 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-1">
            Sign in to claim & pay by email
          </p>
          <Button variant="outline" className="w-full h-9 text-xs justify-start" onClick={() => signIn("google")}>
            Continue with Google
          </Button>
          <Button variant="outline" className="w-full h-9 text-xs justify-start" onClick={() => signIn("twitter")}>
            Continue with X
          </Button>
          <Button variant="outline" className="w-full h-9 text-xs justify-start" onClick={() => signIn("github")}>
            Continue with GitHub
          </Button>
          {devLogin && (
            <div className="pt-1 border-t border-white/5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-amber-400/80 px-1 py-1">
                Dev login (testing)
              </p>
              <div className="flex gap-1">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-8 text-xs bg-background/50 border-white/10"
                />
                <Button
                  className="h-8 text-xs shrink-0"
                  disabled={!email.includes("@")}
                  onClick={() => signIn("dev-email", { email, redirect: false }).then(() => setOpen(false))}
                >
                  Go
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
