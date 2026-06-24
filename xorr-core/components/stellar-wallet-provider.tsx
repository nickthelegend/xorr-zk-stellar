"use client";

// Shared Stellar/Freighter wallet state for the whole app. The original
// single-page wallet kept all of this in App.tsx; here it's lifted into a
// context so the header, dashboard, and every action page share one source of
// truth (connected address, local note set, on-chain pool state, activity log).
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { connect as freighterConnect, currentAddress } from "@/lib/wallet";
import { setSimAccount, setSigner, resetSigner, setTxListener } from "@/lib/stellar";
import { explorerTxUrl } from "@/lib/explorer";
import { burst, celebrate } from "@/lib/confetti";
import {
  type WalletState,
  loadWallet,
  loadWalletForMaster,
  setWalletNamespace,
  shieldedBalance,
  initCrypto,
  resetWallet as resetWalletStore,
} from "@/lib/notes";
import * as pool from "@/lib/pool";
import { artifactsAvailable } from "@/lib/prover";
import { isConfigured } from "@/lib/config";
import { short } from "@/lib/format";
import { getProvider } from "@/lib/identity/provider";
import { setIdentityAuthToken } from "@/lib/identity/self-hosted";
import { custodialSigner } from "@/lib/custodial-signer";
import type { MyIdentity } from "@/lib/identity/types";

export type SignInMode = "freighter" | "sso" | null;

export interface ChainState {
  total: bigint;
  root: string;
}

interface WalletContextValue {
  address: string | null;
  wallet: WalletState | null;
  setWallet: (w: WalletState | null) => void;
  ready: boolean;
  busy: boolean;
  busyMsg: string;
  log: string[];
  pushLog: (m: string) => void;
  proofReady: boolean;
  chain: ChainState | null;
  balance: bigint;
  refreshChain: () => Promise<void>;
  refresh: () => void;
  connect: () => Promise<void>;
  resetWallet: () => void;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
  // SSO / custodial
  signInMode: SignInMode;
  identity: MyIdentity | null;
  claimAccount: () => Promise<void>;
}

const Ctx = createContext<WalletContextValue | null>(null);

// Activity feed persists across reloads (scoped, capped to the last 60 lines).
const LOG_KEY = "xorr.activity.v1";

export function useWallet(): WalletContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet must be used inside <StellarWalletProvider>");
  return c;
}

export function StellarWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [proofReady, setProofReady] = useState(false);
  const [chain, setChain] = useState<ChainState | null>(null);
  const [signInMode, setSignInMode] = useState<SignInMode>(null);
  const [identity, setIdentity] = useState<MyIdentity | null>(null);
  const logLoaded = useRef(false);
  const { ready: privyReady, authenticated, getAccessToken } = usePrivy();

  const pushLog = useCallback((m: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 60));
  }, []);

  const refreshChain = useCallback(async () => {
    if (!isConfigured()) return;
    try {
      const total = await pool.totalShielded();
      const rootBytes = await pool.onChainRoot();
      const root = Array.from(rootBytes, (b) => b.toString(16).padStart(2, "0")).join("");
      setChain({ total, root });
    } catch {
      /* contract not reachable yet — ignore */
    }
  }, []);

  // Persist the activity feed whenever it changes (after the initial load, so we
  // don't clobber saved history with the empty mount state).
  useEffect(() => {
    if (!logLoaded.current) return;
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [log]);

  useEffect(() => {
    (async () => {
      await initCrypto();
      setWallet(loadWallet());
      try {
        const saved = localStorage.getItem(LOG_KEY);
        if (saved) setLog(JSON.parse(saved));
      } catch {
        /* ignore */
      }
      logLoaded.current = true;
      setReady(true);
      const a = await currentAddress();
      if (a) {
        setAddress(a);
        setSimAccount(a);
        refreshChain();
      }
      try {
        setProofReady(await artifactsAvailable("deposit"));
      } catch {
        setProofReady(false);
      }
    })();
  }, [refreshChain]);

  // Privy sign-in: when authenticated, swap the local Freighter wallet for a
  // server-derived custodial identity (keyed by the user's verified email).
  // On sign-out, revert to the Freighter path.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (privyReady && authenticated && signInMode !== "sso") {
        try {
          await initCrypto();
          const token = await getAccessToken();
          setIdentityAuthToken(token || "");
          const id = await getProvider().getMyIdentity();
          if (cancelled) return;
          setWalletNamespace(id.routeKey);
          const w = loadWalletForMaster(id.master);
          setIdentity(id);
          setAddress(id.stellarPub);
          setSimAccount(id.stellarPub);
          setSigner(custodialSigner());
          setSignInMode("sso");
          setWallet(w);
          pushLog(`Signed in with Privy — wallet ${short(id.stellarPub)}`);
          refreshChain();
          try { await pool.scanIncoming(w, pushLog); if (!cancelled) setWallet({ ...w }); } catch { /* delivery off */ }
        } catch (e) {
          pushLog(`⚠ Privy wallet load failed: ${(e as Error).message}`);
        }
      } else if (privyReady && !authenticated && signInMode === "sso") {
        resetSigner();
        setIdentityAuthToken("");
        setWalletNamespace(null);
        setIdentity(null);
        setSignInMode(null);
        setAddress(null);
        setWallet(loadWallet());
        pushLog("Signed out");
      }
    })();
    return () => { cancelled = true; };
  }, [privyReady, authenticated, signInMode, refreshChain, pushLog, getAccessToken]);

  // Surface a clickable toast (→ stellar.expert) for every confirmed on-chain tx.
  useEffect(() => {
    setTxListener((hash, method) => {
      const url = explorerTxUrl(hash);
      pushLog(`✓ ${method} confirmed · ${hash.slice(0, 8)}…`);
      burst();
      toast.success("Transaction confirmed", {
        description: `${method} · ${hash.slice(0, 10)}…${hash.slice(-6)}`,
        action: { label: "Stellar.expert ↗", onClick: () => window.open(url, "_blank", "noopener,noreferrer") },
        duration: 9000,
      });
    });
    return () => setTxListener(null);
  }, [pushLog]);

  const refresh = useCallback(() => {
    setWallet((w) => (w ? { ...w } : w));
  }, []);

  const claimAccount = useCallback(async () => {
    if (signInMode !== "sso") { pushLog("⚠ Sign in first to claim"); return; }
    setBusy(true);
    setBusyMsg("Provisioning your Stellar account");
    try {
      const res = await getProvider().ensureStellarAccount();
      if (res.funded) celebrate();
      pushLog(
        res.funded
          ? `Account ready ${short(res.stellarPub)}${res.trustline ? " + USDC trustline" : ""}`
          : "Account funding pending",
      );
      toast.success(res.funded ? "Account activated 🎉" : "Funding pending");
      if (wallet) { await pool.scanIncoming(wallet, pushLog); setWallet({ ...wallet }); }
      refreshChain();
    } catch (e) {
      pushLog(`⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setBusyMsg("");
    }
  }, [signInMode, wallet, pushLog, refreshChain]);

  const connect = useCallback(async () => {
    try {
      const a = await freighterConnect();
      setAddress(a);
      setSimAccount(a);
      pushLog(`Connected ${short(a)}`);
      refreshChain();
    } catch (e: unknown) {
      pushLog(`⚠ ${(e as Error).message}`);
    }
  }, [pushLog, refreshChain]);

  const resetWallet = useCallback(() => {
    setWallet(resetWalletStore());
    pushLog("Wallet reset for this pool");
  }, [pushLog]);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      if (!address || !wallet) {
        pushLog("⚠ Connect a wallet first");
        return;
      }
      setBusy(true);
      setBusyMsg(label);
      try {
        await fn();
        refresh();
        refreshChain();
      } catch (e: unknown) {
        pushLog(`⚠ ${(e as Error).message ?? e}`);
      } finally {
        setBusy(false);
        setBusyMsg("");
      }
    },
    [address, wallet, pushLog, refresh, refreshChain],
  );

  const balance = wallet ? shieldedBalance(wallet) : 0n;

  return (
    <Ctx.Provider
      value={{
        address,
        wallet,
        setWallet,
        ready,
        busy,
        busyMsg,
        log,
        pushLog,
        proofReady,
        chain,
        balance,
        refreshChain,
        refresh,
        connect,
        resetWallet,
        run,
        signInMode,
        identity,
        claimAccount,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
