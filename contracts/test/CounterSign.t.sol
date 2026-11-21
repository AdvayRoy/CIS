// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {MockToken} from "../src/MockToken.sol";
import {DemoShop} from "../src/DemoShop.sol";
import {CounterSignAccount} from "../src/CounterSignAccount.sol";
import {VulnerableWallet} from "../src/VulnerableWallet.sol";

contract CounterSignTest is Test {
    uint256 constant OWNER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d; // Anvil #1 (public test key)
    uint256 constant START = 1_000e18;
    uint256 constant PRICE = 100e18;

    address owner = vm.addr(OWNER_PK);
    address executor = makeAddr("executor");
    address merchant = makeAddr("merchant");
    address attacker = makeAddr("attacker");

    MockToken token;
    DemoShop shop;
    DemoShop otherShop;
    CounterSignAccount account;
    VulnerableWallet vulnerable;

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new MockToken();
        vm.startPrank(merchant);
        shop = new DemoShop(IERC20(address(token)), attacker);
        otherShop = new DemoShop(IERC20(address(token)), attacker);
        vm.stopPrank();
        account = new CounterSignAccount(owner, executor, IERC20(address(token)));
        vulnerable = new VulnerableWallet(executor);
        token.mint(address(account), START);
        token.mint(address(vulnerable), START);
    }

    function _agreement(uint256 nonce) internal view returns (CounterSignAccount.PurchaseAgreement memory a) {
        a = CounterSignAccount.PurchaseAgreement({
            agreementId: keccak256("agreement-1"),
            token: address(token),
            shop: address(shop),
            itemId: 42,
            maxAmount: PRICE,
            expiry: uint64(block.timestamp + 300),
            nonce: nonce
        });
    }

    function _sign(uint256 pk, CounterSignAccount.PurchaseAgreement memory a) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, account.hashAgreement(a));
        return abi.encodePacked(r, s, v);
    }

    function _assertUntouched() internal view {
        assertEq(token.balanceOf(address(account)), START);
        assertEq(token.allowance(address(account), address(shop)), 0);
        assertEq(token.allowance(address(account), address(otherShop)), 0);
        assertEq(token.balanceOf(attacker), 0);
    }

    // ---- happy path ----

    function test_protectedPurchase_leaves900_andZeroAllowance() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.prank(executor);
        account.executePurchase(a, sig, address(shop), PRICE);

        assertEq(token.balanceOf(address(account)), 900e18);
        assertEq(token.balanceOf(address(shop)), PRICE);
        assertEq(token.allowance(address(account), address(shop)), 0);
        assertEq(shop.purchaseCount(address(account)), 1);
        assertEq(shop.lastItemId(address(account)), 42);
        assertTrue(account.nonceUsed(1));
    }

    function test_priceBelowMax_debitsExactlyPrice() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.prank(executor);
        account.executePurchase(a, sig, address(shop), 60e18);
        assertEq(token.balanceOf(address(account)), 940e18);
        assertEq(token.allowance(address(account), address(shop)), 0);
    }

    // ---- later drain ----

    function test_laterSweep_revertsForProtectedAccount() public {
        test_protectedPurchase_leaves900_andZeroAllowance();
        vm.prank(merchant);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(shop), 0, 900e18)
        );
        shop.sweep(address(account), 900e18);
        assertEq(token.balanceOf(address(account)), 900e18);
        assertEq(token.balanceOf(attacker), 0);
    }

    function test_laterSweep_succeedsForVulnerableWallet() public {
        vm.prank(executor);
        vulnerable.buy(IERC20(address(token)), address(shop), 42, PRICE);
        assertEq(token.balanceOf(address(vulnerable)), 900e18);
        assertEq(token.allowance(address(vulnerable), address(shop)), type(uint256).max);

        vm.prank(merchant);
        shop.sweep(address(vulnerable), 900e18);
        assertEq(token.balanceOf(address(vulnerable)), 0);
        assertEq(token.balanceOf(attacker), 900e18);
    }

    // ---- rejections ----

    function test_wrongShop_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CounterSignAccount.ShopMismatch.selector, address(shop), address(otherShop))
        );
        account.executePurchase(a, sig, address(otherShop), PRICE);
        _assertUntouched();
    }

    function test_rewrittenShopInStruct_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        a.shop = address(otherShop);
        vm.prank(executor);
        vm.expectRevert(CounterSignAccount.InvalidSignature.selector);
        account.executePurchase(a, sig, address(otherShop), PRICE);
        _assertUntouched();
    }

    function test_priceAboveMax_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(CounterSignAccount.AmountExceedsLimit.selector, PRICE, PRICE + 1));
        account.executePurchase(a, sig, address(shop), PRICE + 1);
        _assertUntouched();
    }

    function test_rewrittenMaxInStruct_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        a.maxAmount = START;
        vm.prank(executor);
        vm.expectRevert(CounterSignAccount.InvalidSignature.selector);
        account.executePurchase(a, sig, address(shop), START);
        _assertUntouched();
    }

    function test_expired_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.warp(uint256(a.expiry) + 1);
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(CounterSignAccount.Expired.selector, a.expiry, uint256(a.expiry) + 1));
        account.executePurchase(a, sig, address(shop), PRICE);
        _assertUntouched();
    }

    function test_replayedNonce_reverts_noSecondDebit() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(7);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.prank(executor);
        account.executePurchase(a, sig, address(shop), PRICE);
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(CounterSignAccount.NonceUsed.selector, uint256(7)));
        account.executePurchase(a, sig, address(shop), PRICE);
        assertEq(token.balanceOf(address(account)), 900e18);
        assertEq(shop.purchaseCount(address(account)), 1);
    }

    function test_badSignature_wrongSigner_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(0xBEEF, a);
        vm.prank(executor);
        vm.expectRevert(CounterSignAccount.InvalidSignature.selector);
        account.executePurchase(a, sig, address(shop), PRICE);
        _assertUntouched();
    }

    function test_badSignature_malformed_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        vm.prank(executor);
        vm.expectRevert(CounterSignAccount.InvalidSignature.selector);
        account.executePurchase(a, hex"1234", address(shop), PRICE);
        _assertUntouched();
    }

    function test_wrongChain_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.chainId(block.chainid + 1);
        vm.prank(executor);
        vm.expectRevert(CounterSignAccount.InvalidSignature.selector);
        account.executePurchase(a, sig, address(shop), PRICE);
        _assertUntouched();
    }

    function test_wrongVerifyingContract_reverts() public {
        // Signature made for a different CounterSignAccount instance must not work here.
        CounterSignAccount other = new CounterSignAccount(owner, executor, IERC20(address(token)));
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_PK, other.hashAgreement(a));
        vm.prank(executor);
        vm.expectRevert(CounterSignAccount.InvalidSignature.selector);
        account.executePurchase(a, abi.encodePacked(r, s, v), address(shop), PRICE);
        _assertUntouched();
    }

    function test_wrongDomainName_reverts() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("NotCounterSign"),
                keccak256("1"),
                block.chainid,
                address(account)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(account.PURCHASE_AGREEMENT_TYPEHASH(), a.agreementId, a.token, a.shop, a.itemId, a.maxAmount, a.expiry, a.nonce)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_PK, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        vm.prank(executor);
        vm.expectRevert(CounterSignAccount.InvalidSignature.selector);
        account.executePurchase(a, abi.encodePacked(r, s, v), address(shop), PRICE);
        _assertUntouched();
    }

    function test_wrongToken_reverts() public {
        MockToken other = new MockToken();
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        a.token = address(other);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CounterSignAccount.TokenMismatch.selector, address(other), address(token))
        );
        account.executePurchase(a, sig, address(shop), PRICE);
        _assertUntouched();
    }

    // ---- no bypass path ----

    function test_nonExecutor_reverts_evenOwner() public {
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        bytes memory sig = _sign(OWNER_PK, a);
        vm.prank(owner);
        vm.expectRevert(CounterSignAccount.NotExecutor.selector);
        account.executePurchase(a, sig, address(shop), PRICE);
        _assertUntouched();
    }

    function test_noGenericEntryPoints() public {
        bytes[5] memory calls = [
            abi.encodeWithSignature("execute(address,uint256,bytes)", address(token), 0, ""),
            abi.encodeWithSignature("approve(address,uint256)", address(shop), START),
            abi.encodeWithSignature("transfer(address,uint256)", attacker, START),
            abi.encodeWithSignature("transferOwnership(address)", attacker),
            abi.encodeWithSignature("setExecutor(address)", attacker)
        ];
        for (uint256 i; i < calls.length; i++) {
            vm.prank(owner);
            (bool ok,) = address(account).call(calls[i]);
            assertFalse(ok);
            vm.prank(executor);
            (ok,) = address(account).call(calls[i]);
            assertFalse(ok);
        }
        (bool sent,) = address(account).call{value: 0}("");
        assertFalse(sent);
        _assertUntouched();
    }

    function test_sweepBeforeAnyPurchase_reverts() public {
        vm.prank(merchant);
        vm.expectRevert();
        shop.sweep(address(account), START);
        _assertUntouched();
    }

    function test_sweep_onlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        shop.sweep(address(vulnerable), 1);
    }

    function testFuzz_neverDebitsAboveMax_neverLeavesAllowance(uint256 price, uint256 max) public {
        max = bound(max, 0, START);
        price = bound(price, 0, START * 2);
        CounterSignAccount.PurchaseAgreement memory a = _agreement(1);
        a.maxAmount = max;
        bytes memory sig = _sign(OWNER_PK, a);
        vm.prank(executor);
        try account.executePurchase(a, sig, address(shop), price) {
            assertLe(price, max);
            assertEq(token.balanceOf(address(account)), START - price);
        } catch {
            assertEq(token.balanceOf(address(account)), START);
        }
        assertEq(token.allowance(address(account), address(shop)), 0);
    }
}
