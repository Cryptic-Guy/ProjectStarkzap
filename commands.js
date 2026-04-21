import { createWallet, getBalances, sendTokens } from "./wallet.js";
import { getWallet, saveWallet, getSession, saveSession, clearSession } from "./store.js";
import { encryptKey, decryptKey } from "./crypto.js";

const MENU = `👋 *Welcome to PingPay!*
_Your Starknet wallet on WhatsApp_ 🚀

Choose an option:
1️⃣ Create Wallet
2️⃣ Check Balance
3️⃣ Send Tokens
4️⃣ Receive \/ Deposit
5️⃣ Export Wallet
6️⃣ Help

_Type the number to continue_`;

export async function handleCommand(phone, text) {
  const input = text.trim();
  const session = getSession(phone);
  const step = session.step;

  try {
    // global reset triggers
    if (["0", "menu", "hi", "hello", "hey", "start"].includes(input.toLowerCase())) {
      clearSession(phone);
      return MENU;
    }

    // ── MAIN MENU ──────────────────────────────────────────
    if (step === "menu") {

      if (input === "1") {
        const existing = getWallet(phone);
        if (existing) {
          return (
            `✅ You already have a wallet!\n\n` +
            `📬 *Address:*\n${existing.address}\n\n` +
            `Type *0* to go back to menu.`
          );
        }
        saveSession(phone, { step: "create_pin", data: {} });
        return (
          `🔐 *Create Wallet*\n\n` +
          `Set a *4-8 digit PIN* to secure your wallet.\n\n` +
          `⚠️ If you forget your PIN, funds cannot be recovered!\n\n` +
          `Enter your PIN:`
        );
      }

      if (input === "2") {
        const w = getWallet(phone);
        if (!w) return `❌ No wallet yet!\n\nType *1* to create one.`;
        const { strk, usdt } = await getBalances(w.address);
        return (
          `💰 *Your Balances*\n\n` +
          `⚡ STRK: ${strk}\n\n` +
          `📬 *Address:*\n${w.address}\n\n` +
          `Type *0* for menu.`
        );
      }

      if (input === "3") {
        const w = getWallet(phone);
        if (!w) return `❌ No wallet yet!\n\nType *1* to create one.`;
        saveSession(phone, { step: "send_target", data: {} });
        return (
          `💸 *Send Tokens*\n\n` +
          `Enter recipient *phone number* or *wallet address*:\n\n` +
          `Examples:\n` +
          `• (if number is +91 919876543210) write as 919876543210\n` +
          `• 0x04ab...ef\n\n` +
          `_(Type *0* to cancel)_`
        );
      }

      if (input === "4") {
        const w = getWallet(phone);
        if (!w) return `❌ No wallet yet!\n\nType *1* to create one.`;
        return (
          `📥 *Receive Tokens*\n\n` +
          `Your deposit address:\n\n` +
          `\`${w.address}\`\n\n` +
          `Share this with anyone to receive STRK.\n\n` +
          `💧 Get free test STRK:\n👉 https://starknet-faucet.vercel.app\n\n` +
          `Type *0* for menu.`
        );
      }

      if (input === "5") {
        const w = getWallet(phone);
        if (!w) return `❌ No wallet yet!\n\nType *1* to create one.`;
        saveSession(phone, { step: "export_pin", data: {} });
        return (
          `🔑 *Export Wallet*\n\n` +
          `⚠️ Your private key will be shown!\n` +
          `Never share it with anyone.\n\n` +
          `Enter your PIN to confirm:`
        );
      }

      if (input === "6") {
        return (
          `ℹ️ *About PingPay Bot*\n\n` +
          `A self-custodied Starknet wallet in WhatsApp.\n\n` +
          `*Features:*\n` +
          `• Create wallet instantly\n` +
          `• Send STRK by phone number\n` +
          `• Receive tokens from anyone\n` +
          `• Export key to Ready anytime\n\n` +
          `🌐 Network: Starknet Sepolia Testnet\n` +
          `🔐 PIN-encrypted — we never see your key\n` +
          `⛓️ Powered by StarkZap SDK\n\n` +
          `Type *0* for menu.`
        );
      }

      return MENU;
    }

    // ── CREATE WALLET ──────────────────────────────────────
    if (step === "create_pin") {
      if (!/^\d{4,8}$/.test(input)) {
        return `❌ PIN must be *4-8 digits* only.\n\nTry again:`;
      }
      saveSession(phone, { step: "create_confirm_pin", data: { pin: input } });
      return `✅ Got it!\n\nConfirm PIN — enter it again:`;
    }

    if (step === "create_confirm_pin") {
      if (input !== session.data.pin) {
        clearSession(phone);
        return `❌ PINs don't match!\n\nType *1* to try again.`;
      }
      const pin = session.data.pin;
      const { address, privateKey } = await createWallet();
      const encryptedKey = encryptKey(privateKey, pin);
      saveWallet(phone, address, encryptedKey);
      clearSession(phone);
      return (
        `🎉 *Wallet Created Successfully!*\n\n` +
        `📬 *Your Address:*\n${address}\n\n` +
        `🔐 Secured with your PIN\n` +
        `🌐 Starknet Sepolia Testnet\n\n` +
        `💧 *Fund your wallet:*\n` +
        `1️⃣ Copy address above\n` +
        `2️⃣ 👉 https://starknet-faucet.vercel.app\n` +
        `3️⃣ Paste & claim free STRK!\n\n` +
        `Type *0* for menu.`
      );
    }

    // ── SEND FLOW ──────────────────────────────────────────
    if (step === "send_target") {
      saveSession(phone, { step: "send_amount", data: { target: input } });
      return (
        `💸 Sending to: *${input}*\n\n` +
        `Enter *amount and token*:\n\n` +
        `Examples:\n` +
        `• 5 STRK\n\n` +
        `_(Type *0* to cancel)_`
      );
    }

    if (step === "send_amount") {
      const parts = input.split(" ");
      if (parts.length < 2 || !["STRK", "USDT"].includes(parts[1].toUpperCase())) {
        return `❌ Invalid format.\n\nEnter like: *5 STRK*`;
      }
      saveSession(phone, {
        step: "send_pin",
        data: { ...session.data, amount: parts[0], token: parts[1].toUpperCase() },
      });
      return (
        `💸 *Confirm Transaction*\n\n` +
        `To: *${session.data.target}*\n` +
        `Amount: *${parts[0]} ${parts[1].toUpperCase()}*\n\n` +
        `Enter your *PIN* to confirm:`
      );
    }

    if (step === "send_pin") {
      const w = getWallet(phone);
      let privateKey;
      try {
        privateKey = decryptKey(w.encryptedKey, input);
      } catch (e) {
        clearSession(phone);
        return `${e.message}\n\nType *0* for menu.`;
      }
      const { target, amount, token } = session.data;
      const txHash = await sendTokens(privateKey, target, amount, token, { getWallet });
      clearSession(phone);
      return (
        `✅ *Sent Successfully!*\n\n` +
        `💸 ${amount} ${token} → ${target}\n\n` +
        `🔗 *Tx Hash:*\n${txHash}\n\n` +
        `🔍 View on explorer:\nhttps://sepolia.voyager.online//tx/${txHash}\n\n` +
        `Type *0* for menu.`
      );
    }

    // ── EXPORT FLOW ────────────────────────────────────────
    if (step === "export_pin") {
      const w = getWallet(phone);
      let privateKey;
      try {
        privateKey = decryptKey(w.encryptedKey, input);
      } catch (e) {
        clearSession(phone);
        return `${e.message}\n\nType *0* for menu.`;
      }
      clearSession(phone);
      return (
        `🔑 *Your Private Key*\n\n` +
        `⚠️ *NEVER share this with anyone!*\n\n` +
        `\`${privateKey}\`\n\n` +
        `📬 *Address:*\n\`${w.address}\`\n\n` +
        `📲 *Import into Ready:*\n` +
        `1️⃣ Install Ready extension\n` +
        `2️⃣ Add account → Import account\n` +
        `3️⃣ Paste your private key\n` +
        `4️⃣ Switch to Sepolia testnet\n\n` +
        `🔗 https://www.ready.co/ready-x\n\n` +
        `Type *0* for menu.`
      );
    }

    // fallback
    clearSession(phone);
    return MENU;

  } catch (err) {
    console.error("Command error:", err);
    clearSession(phone);
    return `❌ Something went wrong: ${err.message}\n\nType *0* for menu.`;
  }
}