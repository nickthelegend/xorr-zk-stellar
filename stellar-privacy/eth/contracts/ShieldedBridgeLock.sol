// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ShieldedBridgeLock
/// @notice Ethereum (Sepolia) side of the ShieldedBridge ETH -> Stellar bridge.
///         Users lock ERC-20 USDC together with a note *commitment* (a BN254
///         Poseidon commitment computed client-side). Each lock emits a
///         `Locked(nonce, amount, commitment)` event; the Stellar-side relayer
///         observes it and mints the corresponding shielded note on Soroban via
///         a Groth16 proof. The Stellar `bridge` contract enforces single-use of
///         `nonce`, so locks cannot be double-bridged.
///
///         Funds remain locked here as the on-Ethereum backing for the shielded
///         supply on Stellar. The reverse direction (burn-on-Stellar ->
///         release-here, gated by a proof) is the documented stretch goal and
///         would add a `release(...)` guarded by a Stellar state proof.
contract ShieldedBridgeLock {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public nextNonce;
    uint256 public totalLocked;

    /// commitment is the 32-byte BN254 field element (big-endian) of the note.
    event Locked(uint256 indexed nonce, uint256 amount, bytes32 commitment, address indexed from);

    constructor(IERC20 _token) {
        token = _token;
    }

    /// @notice Lock `amount` of `token` and register `commitment` for bridging.
    /// @return nonce The unique lock id the Stellar relayer will reference.
    function lock(uint256 amount, bytes32 commitment) external returns (uint256 nonce) {
        require(amount > 0, "amount=0");
        require(commitment != bytes32(0), "empty commitment");
        nonce = nextNonce++;
        totalLocked += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Locked(nonce, amount, commitment, msg.sender);
    }
}
