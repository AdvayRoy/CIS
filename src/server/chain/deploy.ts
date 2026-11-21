// Deploys the local-chain demo fixtures and records an evm_snapshot for deterministic reset.
import { createPublicClient, createTestClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import {
  CounterSignAccountAbi, CounterSignAccountBytecode, DemoShopAbi, DemoShopBytecode,
  MockTokenAbi, MockTokenBytecode, VulnerableWalletAbi, VulnerableWalletBytecode,
} from "./artifacts";
import { ATTACKER_ADDRESS, executorAccount, rpcUrl, signerAddress, writeDeployment, type Deployment } from "./config";

export const START_BALANCE = parseUnits("1000", 18);

export async function deployAll(): Promise<Deployment> {
  const transport = http(rpcUrl());
  const account = executorAccount();
  const pub = createPublicClient({ transport });
  const chainId = await pub.getChainId();
  const chain = {
    id: chainId, name: "Local-chain demo",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl()] } },
  } as const;
  const wallet = createWalletClient({ account, chain, transport });
  const test = createTestClient({ mode: "anvil", transport });

  const mined = async (hash: Hex) => {
    const r = await pub.waitForTransactionReceipt({ hash, pollingInterval: 50 });
    if (r.status !== "success") throw new Error(`deploy transaction reverted: ${hash}`);
    return r;
  };
  const deploy = async (hash: Hex) => {
    const r = await mined(hash);
    if (!r.contractAddress) throw new Error("no contract address in receipt");
    return r.contractAddress;
  };

  const owner = signerAddress();
  const token = await deploy(await wallet.deployContract({ abi: MockTokenAbi, bytecode: MockTokenBytecode }));
  const shop = await deploy(
    await wallet.deployContract({ abi: DemoShopAbi, bytecode: DemoShopBytecode, args: [token, ATTACKER_ADDRESS] }),
  );
  const protectedAccount = await deploy(
    await wallet.deployContract({
      abi: CounterSignAccountAbi, bytecode: CounterSignAccountBytecode, args: [owner, account.address, token],
    }),
  );
  const vulnerable = await deploy(
    await wallet.deployContract({ abi: VulnerableWalletAbi, bytecode: VulnerableWalletBytecode, args: [account.address] }),
  );
  await mined(await wallet.writeContract({ address: token, abi: MockTokenAbi, functionName: "mint", args: [protectedAccount, START_BALANCE] }));
  const last = await mined(
    await wallet.writeContract({ address: token, abi: MockTokenAbi, functionName: "mint", args: [vulnerable, START_BALANCE] }),
  );

  const snapshotId = await test.snapshot();
  const d: Deployment = {
    chainId, token, shop, account: protectedAccount, vulnerable, attacker: ATTACKER_ADDRESS,
    signer: owner, executor: account.address, deployBlock: last.blockNumber.toString(), snapshotId, deployedAt: Date.now(),
  };
  writeDeployment(d);
  return d;
}
