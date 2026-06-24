// Thin Freighter wrapper for Stellar signing.
import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from "@stellar/freighter-api";
import { NETWORK_PASSPHRASE } from "./config";

export async function freighterInstalled(): Promise<boolean> {
  const res = await isConnected();
  return Boolean(res?.isConnected);
}

/** Prompt the user to connect Freighter; returns their public key (G...). */
export async function connect(): Promise<string> {
  if (!(await freighterInstalled())) {
    throw new Error("Freighter is not installed. Get it at https://freighter.app");
  }
  if (!(await isAllowed())?.isAllowed) {
    await setAllowed();
  }
  const access = await requestAccess();
  if (access.error) throw new Error(access.error);
  return access.address;
}

export async function currentAddress(): Promise<string | null> {
  try {
    const a = await getAddress();
    return a.address || null;
  } catch {
    return null;
  }
}

export async function currentNetwork(): Promise<string> {
  const n = await getNetwork();
  return n.network ?? "UNKNOWN";
}

/** Sign a transaction XDR with Freighter; returns the signed XDR. */
export async function sign(xdr: string): Promise<string> {
  const res = await signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE });
  if (res.error) throw new Error(res.error);
  return res.signedTxXdr;
}
