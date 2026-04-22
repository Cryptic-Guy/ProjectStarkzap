import "dotenv/config";
import { StarkZap, StarkSigner, OnboardStrategy, sepoliaTokens, Amount, fromAddress } from "starkzap";
import { stark, RpcProvider, Account, CallData, hash } from "starknet";

const RPC_URL = process.env.RPC_URL;

function getSDK() {
  return new StarkZap({ network: "sepolia", rpcUrl: RPC_URL });
}

const provider = new RpcProvider({ nodeUrl: RPC_URL });

// This is the class hash StarkZap uses
const CLASS_HASH = "0x1d1777db36cdd06dd62cfde77b1b6ae06412af95d57a13dc40ac77b8a702381";

async function getWalletInstance(privateKey, deploy = "never") {
  const sdk = getSDK();
  const { wallet } = await sdk.onboard({
    strategy: OnboardStrategy.Signer,
    account: { signer: new StarkSigner(privateKey) },
    deploy,
  });
  return wallet;
}

async function deployWithStarknetJs(privateKey) {
  // Derive address the same way StarkZap does
  const publicKey = privateKey; // StarkZap uses pk as salt
  const constructorCalldata = CallData.compile({ publicKey });
  const address = hash.calculateContractAddressFromHash(
    publicKey,
    CLASS_HASH,
    constructorCalldata,
    0
  );

  const account = new Account(provider, address, privateKey);

  const { transaction_hash } = await account.deployAccount({
    classHash: CLASS_HASH,
    constructorCalldata,
    contractAddress: address,
    addressSalt: publicKey,
  });

  console.log("📦 Deploy tx:", transaction_hash);
  await provider.waitForTransaction(transaction_hash);
  console.log("✅ Deployed via starknet.js!");
  return address;
}

async function prefundWallet(toAddress) {
  console.log("💸 Prefunding", toAddress);
  const sponsorWallet = await getWalletInstance(process.env.SPONSOR_PRIVATE_KEY, "never");

  // Use raw starknet.js account for sponsor too
  const sponsorAccount = new Account(provider, sponsorWallet.address, process.env.SPONSOR_PRIVATE_KEY);

  const { transaction_hash } = await sponsorAccount.execute({
    contractAddress: sepoliaTokens.STRK.address,
    entrypoint: "transfer",
    calldata: CallData.compile({
      recipient: toAddress,
      amount: { low: BigInt("500000000000000000"), high: 0n }, // 0.5 STRK
    }),
  });

  await provider.waitForTransaction(transaction_hash);
  console.log("✅ Prefunded! tx:", transaction_hash);
  await new Promise(r => setTimeout(r, 5000));
}

export async function createWallet() {
  const privateKey = stark.randomAddress();

  // Get address without deploying
  const wallet = await getWalletInstance(privateKey, "never");
  const address = wallet.address;
  console.log("📬 New wallet:", address);

  // Prefund
  await prefundWallet(address);

  // Deploy using raw starknet.js (bypasses StarkZap deploy bug)
  await deployWithStarknetJs(privateKey);

  return { address, privateKey };
}

export async function getBalances(privateKey) {
  const wallet = await getWalletInstance(privateKey, "never");
  const strk = await wallet.balanceOf(sepoliaTokens.STRK);
  const usdt = await wallet.balanceOf(sepoliaTokens.USDT);
  return { strk: strk.toFormatted(), usdt: usdt.toFormatted() };
}

export async function sendTokens(privateKey, toTarget, amount, tokenSymbol, store) {
  let toAddress = toTarget;
  if (!toTarget.startsWith("0x")) {
    const phone = toTarget.replace(/\D/g, "");
    const recipient = store.getWallet(phone);
    if (!recipient) throw new Error(`❌ Phone ${toTarget} is not registered.`);
    toAddress = recipient.address;
  }

  const wallet = await getWalletInstance(privateKey, "if_needed");
  const token = tokenSymbol.toUpperCase() === "USDT" ? sepoliaTokens.USDT : sepoliaTokens.STRK;
  const tx = await wallet.transfer(token, [
    { to: fromAddress(toAddress), amount: Amount.parse(amount, token) },
  ]);
  await tx.wait();
  return tx.hash;
}
