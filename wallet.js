import "dotenv/config";
import { StarkZap, StarkSigner, OnboardStrategy } from "starkzap";
import { ec, RpcProvider, CallData, uint256 } from "starknet";

const TOKENS = {
  STRK: {
    address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    decimals: 18,
    symbol: "STRK",
  },
  USDT: {
    address: "0x02ab8758891e84b968ff11361789070c6b1af2df618d6d2f4a78b0757573c6eb",
    decimals: 6,
    symbol: "USDT",
  },
};

function getRPC() {
  const url = process.env.RPC_URL;
  if (!url) throw new Error("RPC_URL is not set in .env!");
  return url;
}

function getProvider() {
  return new RpcProvider({ nodeUrl: getRPC() });
}

function getSDK() {
  return new StarkZap({ network: "sepolia", rpcUrl: getRPC() });
}

export async function createWallet() {
  // ✅ FIX: Use `ec.starkCurve` directly (imported from starknet), not `stark.ec.starkCurve`
  // In starknet.js v6+, `stark.ec` no longer exists — `ec` is a top-level named export
  const rawKey = ec.starkCurve.utils.randomPrivateKey();
  const privateKey =
    "0x" +
    Array.from(rawKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const sdk = getSDK();
  const { wallet } = await sdk.onboard({
    strategy: OnboardStrategy.Signer,
    account: { signer: new StarkSigner(privateKey) },
    deploy: "never",
  });

  return { address: wallet.address, privateKey };
}

export async function getBalances(address) {
  const provider = getProvider();

  async function getTokenBalance(token) {
    try {
      const result = await provider.callContract({
        contractAddress: token.address,
        entrypoint: "balanceOf",
        calldata: [address],
      });
      const low = BigInt(result[0]);
      const high = BigInt(result[1]);
      const raw = low + high * 2n ** 128n;
      const divisor = BigInt(10 ** token.decimals);
      const whole = raw / divisor;
      const fraction = raw % divisor;
      const formatted = `${whole}.${fraction
        .toString()
        .padStart(token.decimals, "0")
        .slice(0, 4)}`;
      return `${formatted} ${token.symbol}`;
    } catch (e) {
      return `0.0000 ${token.symbol}`;
    }
  }

  const strk = await getTokenBalance(TOKENS.STRK);
  const usdt = await getTokenBalance(TOKENS.USDT);
  return { strk, usdt };
}

export async function sendTokens(privateKey, toTarget, amount, tokenSymbol, store) {
  if (!privateKey) throw new Error("Private key is missing.");

  // 1. Resolve Recipient
  let toAddress = toTarget;
  if (!toTarget.startsWith("0x")) {
    const phone = toTarget.replace(/\D/g, "");
    const recipient = store.getWallet(phone);
    if (!recipient) throw new Error(`Phone ${toTarget} is not registered.`);
    toAddress = recipient.address;
  }

  const token = TOKENS[tokenSymbol.toUpperCase()];
  if (!token) throw new Error(`Unsupported token: ${tokenSymbol}`);

  const sdk = getSDK();
  const provider = getProvider();

  // 2. Onboard via SDK
  const { wallet } = await sdk.onboard({
    strategy: OnboardStrategy.Signer,
    account: { signer: new StarkSigner(privateKey) },
    deploy: "never",
  });

  console.log("💳 Sending from:", wallet.address);

  // 3. Ensure Wallet is Deployed
  await wallet.ensureReady({ deploy: "if_needed" });

  // 4. Prepare Amount
  const amountBN = BigInt(Math.round(parseFloat(amount) * 10 ** token.decimals));
  const amountUint256 = uint256.bnToUint256(amountBN);

  try {
    // 5. Execute Transfer
    const result = await wallet.execute({
      contractAddress: token.address,
      entrypoint: "transfer",
      calldata: CallData.compile({
        recipient: toAddress,
        amount: amountUint256,
      }),
    });

    // 6. Get Hash
    const txHash = result.hash || result.transaction_hash || result.transactionHash;

    if (!txHash) {
      console.error("Unexpected Result Object:", result);
      throw new Error("Transaction failed: Could not find transaction hash.");
    }

    console.log("⏳ Waiting for tx:", txHash);

    // 7. Wait for confirmation
    await provider.waitForTransaction(txHash);

    return txHash;
  } catch (error) {
    console.error("Execution failed:", error.message);
    throw error;
  }
}
