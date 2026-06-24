// Soroban contract invocation: build -> simulate -> assemble -> sign -> send.
import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  rpc as SorobanRpc,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";
import { RPC_URL, NETWORK_PASSPHRASE } from "../config";
import { sign } from "./wallet";

export const server = new SorobanRpc.Server(RPC_URL, {
  allowHttp: RPC_URL.startsWith("http://"),
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read-only contract call via simulation (no signature, no fee). */
export async function simulateCall(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<any> {
  const account = await server.getAccount(
    // any funded account works for simulation; use a throwaway if needed
    await anyAccountId(),
  );
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result?.retval) return null;
  return scValToNative(sim.result.retval);
}

/** State-changing invocation signed by `publicKey` via Freighter. */
export async function invoke(
  publicKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<{ hash: string; returnValue: any }> {
  const account = await server.getAccount(publicKey);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(built);
  if (SorobanRpc.Api.isSimulationError(sim)) throw new Error(`simulation failed: ${sim.error}`);

  const prepared = SorobanRpc.assembleTransaction(built, sim).build();
  const signedXdr = await sign(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sent = await server.sendTransaction(signed as any);
  if (sent.status === "ERROR") throw new Error(`send failed: ${JSON.stringify(sent.errorResult)}`);

  let got = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && got.status === "NOT_FOUND"; i++) {
    await delay(1000);
    got = await server.getTransaction(sent.hash);
  }
  if (got.status !== "SUCCESS") throw new Error(`tx ${sent.hash} status=${got.status}`);

  return {
    hash: sent.hash,
    returnValue: got.returnValue ? scValToNative(got.returnValue) : null,
  };
}

// ---- ScVal builders ----------------------------------------------------

export const addr = (a: string): xdr.ScVal => new Address(a).toScVal();
export const i128 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "i128" });
export const u64 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "u64" });

/** 32-byte value (commitment/nullifier/root) -> ScVal BytesN<32>. */
export function bytesN32(bytes: Uint8Array): xdr.ScVal {
  if (bytes.length !== 32) throw new Error("expected 32 bytes");
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

// Cache a funded account id for simulations (the connected wallet, ideally).
let _simAccount: string | null = null;
export function setSimAccount(id: string) {
  _simAccount = id;
}
async function anyAccountId(): Promise<string> {
  if (_simAccount) return _simAccount;
  throw new Error("No account available for simulation — connect a wallet first.");
}
