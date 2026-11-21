// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPurchaseShop {
    function purchase(uint256 itemId, uint256 price) external;
    function purchaseCount(address buyer) external view returns (uint256);
}

/// @notice Minimal customer smart account for the CounterSign demo.
/// @dev The ONLY state-changing entry point is `executePurchase`. There is no generic
///      execute, no delegatecall, no owner change, and no other way to move tokens or
///      grant an allowance. One signed agreement = one exact, bounded purchase.
contract CounterSignAccount is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PurchaseAgreement {
        bytes32 agreementId;
        address token;
        address shop;
        uint256 itemId;
        uint256 maxAmount;
        uint64 expiry;
        uint256 nonce;
    }

    bytes32 public constant PURCHASE_AGREEMENT_TYPEHASH = keccak256(
        "PurchaseAgreement(bytes32 agreementId,address token,address shop,uint256 itemId,uint256 maxAmount,uint64 expiry,uint256 nonce)"
    );

    /// @notice Customer signer whose EIP-712 signature authorises a purchase. Immutable.
    address public immutable owner;
    /// @notice Relayer allowed to submit signed agreements. Immutable.
    address public immutable executor;
    /// @notice The single token this account spends. Immutable.
    IERC20 public immutable token;

    mapping(uint256 nonce => bool) public nonceUsed;

    event PurchaseExecuted(bytes32 indexed agreementId, address indexed shop, uint256 itemId, uint256 price, uint256 nonce);

    error NotExecutor();
    error InvalidSignature();
    error TokenMismatch(address signed, address supported);
    error ShopMismatch(address signed, address attempted);
    error AmountExceedsLimit(uint256 maxAmount, uint256 attempted);
    error Expired(uint64 expiry, uint256 nowTs);
    error NonceUsed(uint256 nonce);
    error DirtyAllowance(uint256 allowance);
    error ResidualAllowance(uint256 allowance);
    error DebitMismatch(uint256 expected, uint256 actual);
    error PurchaseNotRecorded();

    constructor(address owner_, address executor_, IERC20 token_) EIP712("CounterSign", "1") {
        owner = owner_;
        executor = executor_;
        token = token_;
    }

    function hashAgreement(PurchaseAgreement calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PURCHASE_AGREEMENT_TYPEHASH, a.agreementId, a.token, a.shop, a.itemId, a.maxAmount, a.expiry, a.nonce
                )
            )
        );
    }

    function executePurchase(PurchaseAgreement calldata a, bytes calldata sig, address shop, uint256 price)
        external
        nonReentrant
    {
        if (msg.sender != executor) revert NotExecutor();
        _authorize(a, sig, shop, price);
        _purchase(shop, a.itemId, price);
        emit PurchaseExecuted(a.agreementId, shop, a.itemId, price, a.nonce);
    }

    function _authorize(PurchaseAgreement calldata a, bytes calldata sig, address shop, uint256 price) private {
        // 1. Authorisation: owner's EIP-712 signature over the exact agreement, bound to this chain + contract.
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(hashAgreement(a), sig);
        if (err != ECDSA.RecoverError.NoError || recovered != owner) revert InvalidSignature();

        // 2. The attempted call must match the signed facts; the authorisation is single use.
        if (a.token != address(token)) revert TokenMismatch(a.token, address(token));
        if (shop != a.shop) revert ShopMismatch(a.shop, shop);
        if (price > a.maxAmount) revert AmountExceedsLimit(a.maxAmount, price);
        if (block.timestamp > a.expiry) revert Expired(a.expiry, block.timestamp);
        if (nonceUsed[a.nonce]) revert NonceUsed(a.nonce);
        nonceUsed[a.nonce] = true;
    }

    function _purchase(address shop, uint256 itemId, uint256 price) private {
        // 3. Start from a known approval state.
        uint256 pre = token.allowance(address(this), shop);
        if (pre != 0) revert DirtyAllowance(pre);

        uint256 balanceBefore = token.balanceOf(address(this));
        uint256 countBefore = IPurchaseShop(shop).purchaseCount(address(this));

        // 4. Exact approval -> supported purchase -> remove any remaining approval, atomically.
        token.forceApprove(shop, price);
        IPurchaseShop(shop).purchase(itemId, price);
        token.forceApprove(shop, 0);

        // 5. Verify outcome: no residual allowance, bounded exact debit, purchase recorded.
        uint256 post = token.allowance(address(this), shop);
        if (post != 0) revert ResidualAllowance(post);
        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter > balanceBefore || balanceBefore - balanceAfter != price) {
            revert DebitMismatch(price, balanceAfter > balanceBefore ? 0 : balanceBefore - balanceAfter);
        }
        if (IPurchaseShop(shop).purchaseCount(address(this)) != countBefore + 1) revert PurchaseNotRecorded();
    }
}
