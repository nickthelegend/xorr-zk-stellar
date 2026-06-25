// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

// Self-contained (no external imports) so it compiles with solc-js and deploys
// to Sepolia in one step — the testnet realisation of the XORR ShieldedBridge.

/// @title TestUSDC — a mintable, USDC-shaped ERC-20 (6 decimals) for the demo.
/// @notice `mint` is open so the in-app faucet can fund any connected wallet.
contract TestUSDC {
    string public constant name = "XORR Test USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// Open faucet mint — anyone can mint test USDC to any address.
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}

interface IERC20Min {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// @title ShieldedBridgeEscrow — two-way Ethereum (Sepolia) side of the bridge.
/// @notice
///  Forward (ETH → Stellar): `lock(amount, commitment)` escrows USDC and emits
///  `Locked(nonce, amount, commitment)`. The Stellar relayer observes it and
///  mints the shielded note on Soroban via a Groth16 proof (verified on-chain).
///
///  Reverse (Stellar → ETH): after a user burns shielded xUSDC on Stellar (a ZK
///  spend that publishes a `nullifier`), the authorized relayer calls
///  `release(to, amount, nullifier)` to pay the backing USDC out here. The
///  nullifier is single-use, so a burn can't be double-released.
contract ShieldedBridgeEscrow {
    IERC20Min public immutable token;
    address public immutable relayer;
    uint256 public nextNonce;
    uint256 public totalLocked;
    mapping(bytes32 => bool) public releasedNullifier;

    event Locked(uint256 indexed nonce, uint256 amount, bytes32 commitment, address indexed from);
    event Released(bytes32 indexed nullifier, uint256 amount, address indexed to);

    constructor(IERC20Min _token, address _relayer) {
        token = _token;
        relayer = _relayer;
    }

    function lock(uint256 amount, bytes32 commitment) external returns (uint256 nonce) {
        require(amount > 0, "amount=0");
        require(commitment != bytes32(0), "empty commitment");
        nonce = nextNonce++;
        totalLocked += amount;
        require(token.transferFrom(msg.sender, address(this), amount), "transferFrom");
        emit Locked(nonce, amount, commitment, msg.sender);
    }

    function release(address to, uint256 amount, bytes32 nullifier) external {
        require(msg.sender == relayer, "not relayer");
        require(nullifier != bytes32(0), "empty nullifier");
        require(!releasedNullifier[nullifier], "nullifier used");
        releasedNullifier[nullifier] = true;
        require(amount <= totalLocked, "over-release");
        totalLocked -= amount;
        require(token.transfer(to, amount), "transfer");
        emit Released(nullifier, amount, to);
    }
}
