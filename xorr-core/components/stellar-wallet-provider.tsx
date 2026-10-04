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
import { toast } from "sonner";
import { connect as walletConnect, currentAddress, disconnect as walletDisconnect } from "@/lib/wallet";
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
import { redeemClaimToken, claimTokenSigner } from "@/lib/identity/claim-token";
import { encKeyPair, encPubB64 } from "@/lib/delivery";
import type { MyIdentity } from "@/lib/identity/types";

// "claim" = a magic-link session (opened a …/claim?t=… email link): a custodial
// wallet authenticated by the claim token. "freighter" = a connected Freighter
// wallet. (Sign-in / Privy SSO was removed — the claim link is the custodial path.)
export type SignInMode = "freighter" | "claim" | null;

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
  disconnectWallet: () => Promise<void>;
  resetWallet: () => void;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
  // Custodial session state
  signInMode: SignInMode;
  identity: MyIdentity | null;
  // Magic claim link: redeem a …/claim?t=<token> link into a custodial session.
  claimWithToken: (token: string) => Promise<void>;
  // Same link, but deliver the payment into the connected wallet (if one is
  // connected); falls back to claimWithToken otherwise.
  claimIntoConnected: (token: string) => Promise<void>;
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

  // Surface a clickable toast (→ stellar.expert) for every confirmed on-chain tx.
  useEffect(() => {
    setTxListener((hash, method) => {
      const url = explorerTxUrl(hash);
      pushLog(`✓ ${method} submitted · ${hash.slice(0, 8)}…`);
      burst();
      toast.success("Transaction submitted", {
        description: `${method} · ${hash.slice(0, 10)}…${hash.slice(-6)}`,
        action: { label: "Stellar.expert ↗", onClick: () => window.open(url, "_blank", "noopener,noreferrer") },
        duration: 10000,
      });
    });
    return () => setTxListener(null);
  }, [pushLog]);

  const refresh = useCallback(() => {
    setWallet((w) => (w ? { ...w } : w));
  }, []);

  // Magic claim link: the emailed token is the credential (no Privy sign-in).
  // Redeem it → custodial identity + funded account, load the wallet from the
  // returned master, and scan/decrypt the delivered note so it's spendable.
  const claimWithToken = useCallback(async (token: string) => {
    setBusy(true);
    setBusyMsg("Opening your private payment");
    try {
      await initCrypto();
      const res = await redeemClaimToken(token);
      setWalletNamespace(res.routeKey);
      const w = loadWalletForMaster(res.master);
      setIdentity({ master: res.master, encPub: res.encPub, stellarPub: res.stellarPub, routeKey: res.routeKey });
      setAddress(res.stellarPub);
      setSimAccount(res.stellarPub);
      setSigner(claimTokenSigner(token)); // so the claimed funds can be withdrawn/sent
      setSignInMode("claim");
      setWallet(w);
      if (res.funded) celebrate();
      pushLog(`Claim link opened — wallet ${short(res.stellarPub)}${res.trustline ? " + USDC trustline" : ""}`);
      refreshChain();
      try {
        await pool.scanIncoming(w, pushLog);
        setWallet({ ...w });
      } catch {
        /* delivery layer off — nothing to scan */
      }
      toast.success("Payment claimed 🎉");
    } catch (e) {
      pushLog(`⚠ ${(e as Error).message}`);
      throw e;
    } finally {
      setBusy(false);
      setBusyMsg("");
    }
  }, [pushLog, refreshChain]);

  // Claim a magic-link payment INTO the currently connected (Freighter) wallet
  // instead of a fresh custodial one: redeem the email identity, re-deliver its
  // note(s) to this wallet's shielded address, then scan them in. No on-chain tx
  // (stealth notes: holding the opening = control). Falls back to the auto-wallet
  // claim when no wallet is connected.
  const claimIntoConnected = useCallback(async (token: string) => {
    if (signInMode !== "freighter" || !wallet) return claimWithToken(token);
    setBusy(true);
    setBusyMsg("Claiming into your wallet");
    try {
      await initCrypto();
      const res = await redeemClaimToken(token); // provisions + funds the email identity
      const myEncPub = encPubB64(encKeyPair(BigInt(wallet.master)));
      const n = await pool.claimNotesToAddress(res.master, myEncPub, pushLog);
      await pool.scanIncoming(wallet, pushLog); // pull the handed-over notes into this wallet
      setWallet({ ...wallet });
      refreshChain();
      if (n > 0) {
        celebrate();
        toast.success("Payment claimed into your wallet 🎉");
      } else {
        toast.message("No new payment found (already claimed?)");
      }
      pushLog(`Claimed ${n} payment(s) into ${short(address!)}`);
    } catch (e) {
      pushLog(`⚠ ${(e as Error).message}`);
      throw e;
    } finally {
      setBusy(false);
      setBusyMsg("");
    }
  }, [signInMode, wallet, address, pushLog, refreshChain, claimWithToken]);

  const connect = useCallback(async () => {
    try {
      const a = await walletConnect();
      setAddress(a);
      setSimAccount(a);
      setSignInMode("freighter");
      pushLog(`Connected ${short(a)}`);
      refreshChain();
    } catch (e: unknown) {
      pushLog(`⚠ ${(e as Error).message}`);
    }
  }, [pushLog, refreshChain]);

  const disconnectWallet = useCallback(async () => {
    await walletDisconnect();
    resetSigner();
    setAddress(null);
    setSignInMode((m) => (m === "freighter" ? null : m));
    pushLog("Wallet disconnected");
  }, [pushLog]);

  const resetWallet = useCallback(() => {
    setWallet(resetWalletStore());
    pushLog("Wallet reset for this pool");
  }, [pushLog]);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      if (!address || !wallet) {
        pushLog("⚠ Connect a wallet first");
        toast.error("Connect a wallet first", { description: "Click “Connect wallet” (top right) and make sure Freighter is on Testnet." });
        return;
      }
      setBusy(true);
      setBusyMsg(label);
      // A visible, page-independent progress toast — the Home page has no activity
      // panel, so without this a failure (or a slow step) shows the user nothing.
      const tid = toast.loading(`${label}…`);
      try {
        await fn();
        refresh();
        refreshChain();
        toast.dismiss(tid); // success is announced separately by the on-chain tx toast
      } catch (e: unknown) {
        const msg = (e as Error).message ?? String(e);
        pushLog(`⚠ ${msg}`);
        toast.error(msg, { id: tid, duration: 12000 });
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
        disconnectWallet,
        resetWallet,
        run,
        signInMode,
        identity,
        claimWithToken,
        claimIntoConnected,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
