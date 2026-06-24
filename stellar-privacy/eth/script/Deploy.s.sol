// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ShieldedBridgeLock} from "../contracts/ShieldedBridgeLock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Deploy ShieldedBridgeLock against an existing ERC-20 USDC on Sepolia.
///   forge script script/Deploy.s.sol --rpc-url sepolia --broadcast \
///     --sig "run(address)" <USDC_ADDRESS> --private-key $PK
contract Deploy is Script {
    function run(address usdc) external {
        vm.startBroadcast();
        ShieldedBridgeLock lock = new ShieldedBridgeLock(IERC20(usdc));
        console2.log("ShieldedBridgeLock:", address(lock));
        vm.stopBroadcast();
    }
}
