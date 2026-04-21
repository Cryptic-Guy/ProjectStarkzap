import "dotenv/config";
import { StarkZap, StarkSigner, OnboardStrategy, sepoliaTokens } from "starkzap";

const sdk = new StarkZap({ network: "sepolia" });
const { wallet } = await sdk.onboard({
  strategy: OnboardStrategy.Signer,
  account: { signer: new StarkSigner(process.env.SPONSOR_PRIVATE_KEY) },
  deploy: "never",
});

console.log("Sponsor address:", wallet.address);
const bal = await wallet.balanceOf(sepoliaTokens.STRK);
console.log("Sponsor STRK balance:", bal.toFormatted());