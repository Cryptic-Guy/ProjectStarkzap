import "dotenv/config";
import { StarkZap, StarkSigner, OnboardStrategy, sepoliaTokens } from "starkzap";
import { RpcProvider } from "starknet";

const RPC_URL = process.env.RPC_URL;
console.log("Using RPC:", RPC_URL);

// Check via StarkZap
const sdk = new StarkZap({ network: "sepolia", rpcUrl: RPC_URL });
const { wallet } = await sdk.onboard({
  strategy: OnboardStrategy.Signer,
  account: { signer: new StarkSigner(process.env.SPONSOR_PRIVATE_KEY) },
  deploy: "never",
});

console.log("Sponsor address:", wallet.address);
console.log("STRK token address:", sepoliaTokens.STRK.address);

// StarkZap balance
const strkBal = await wallet.balanceOf(sepoliaTokens.STRK);
console.log("StarkZap STRK balance:", strkBal.toFormatted());

// Double check via raw starknet.js
const provider = new RpcProvider({ nodeUrl: RPC_URL });
const result = await provider.callContract({
  contractAddress: sepoliaTokens.STRK.address,
  entrypoint: "balanceOf",
  calldata: [wallet.address],
});
console.log("Raw STRK balance (wei):", result[0]);
console.log("Raw STRK balance:", Number(BigInt(result[0])) / 1e18);