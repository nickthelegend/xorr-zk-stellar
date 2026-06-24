# In-browser proving artifacts

The shielded wallet generates Groth16 proofs in your browser with snarkjs. It
loads circuit artifacts from this folder:

```
deposit.wasm   deposit.zkey
transfer.wasm  transfer.zkey
withdraw.wasm  withdraw.zkey
disclose.wasm  disclose.zkey  disclose.vkey.json
```

These are produced by compiling the circuits + running the trusted setup in the
**xorr-stellar-contracts** repo, then copied here:

```bash
cd ../xorr-stellar-contracts/circuits
pnpm install && pnpm build          # compile circuits + trusted setup
cp build/*_js/*.wasm build/*.zkey  /path/to/xorr-core/public/circuits/
```

Until they're present, the wallet runs in **note-management mode**: you can see
balances and the constellation, but proof-backed actions (deposit/send/withdraw/
bridge/disclose) need these files. The UI shows a banner when they're missing.
