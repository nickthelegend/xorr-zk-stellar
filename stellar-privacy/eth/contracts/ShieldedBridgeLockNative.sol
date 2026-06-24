// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title ShieldedBridgeLockNative
/// @notice Minimal, dependency-free native-ETH variant of the ShieldedBridge
///         lock, used for the live Sepolia demo (no ERC-20/faucet needed). Lock
///         ETH together with a BN254 Poseidon note `commitment`; each lock emits
///         `Locked(nonce, amount, commitment, from)`. The Stellar relayer reads
///         the event and mints the shielded note on Soroban via a Groth16 proof,
///         which the `bridge` contract verifies on-chain (nonce single-use).
///
///         The production path is `ShieldedBridgeLock.sol` (ERC-20 USDC); this
///         keeps the same event ABI so the relayer code is identical.
contract ShieldedBridgeLockNative {
    uint256 public nextNonce;
    uint256 public totalLocked;

    event Locked(uint256 indexed nonce, uint256 amount, bytes32 commitment, address indexed from);

    /// @notice Lock `msg.value` ETH and register `commitment` for bridging.
    function lock(bytes32 commitment) external payable returns (uint256 nonce) {
        require(msg.value > 0, "amount=0");
        require(commitment != bytes32(0), "empty commitment");
        nonce = nextNonce++;
        totalLocked += msg.value;
        emit Locked(nonce, msg.value, commitment, msg.sender);
    }
}
