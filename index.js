import "dotenv/config";
import express from "express";
import twilio from "twilio";

// Import your StarkZap SDK logic
import { handleCommand } from "./commands.js";
import { getWallet } from "./store.js";
import { decryptKey } from "./crypto.js";
import { sendTokens } from "./wallet.js";

const app = express();

// Twilio sends data as URL-encoded forms
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { VoiceResponse } = twilio.twiml;

// Hackathon Shortcut: Assumed PIN for Voice Demo users
const DEFAULT_PIN = "2004"; 

app.get("/", (req, res) => res.send("🚀 StarkZap Gateway (WhatsApp + Voice) is running ✅"));

// ==========================================
// 📱 1. WHATSAPP GATEWAY (Text Interface)
// ==========================================
app.post("/webhook", async (req, res) => {
  // Twilio requires a 200 OK fast, so we send it immediately
  res.sendStatus(200); 

  const from = req.body.From;
  const text = req.body.Body?.trim();
  console.log(`📩 WhatsApp from: ${from} | Message: ${text}`);

  const phone = from.replace("whatsapp:+", "");

  // Process through your menu logic
  const reply = await handleCommand(phone, text || "hi");

  // Send the reply back to the user
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: from,
    body: reply,
  });
  console.log(`✅ WhatsApp reply sent to ${phone}`);
});

// ==========================================
// 📞 2. VOICE GATEWAY (Keypad Comma-Dialing)
// ==========================================
app.post("/voice/gateway", (req, res) => {
  const twiml = new VoiceResponse();
  const senderPhone = req.body.From.replace('+', ''); // Clean +91

  const sender = getWallet(senderPhone);

  if (!sender) {
    console.log(`❌ Voice call from unregistered number: ${senderPhone}`);
    twiml.say("Number not registered. Please join Stark Zap on WhatsApp first.");
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  // Listen for the digits after the commas (e.g., 1*918983312805)
  const gather = twiml.gather({
    action: '/voice/process-tx',
    input: 'dtmf',
    timeout: 10,
    finishOnKey: '' // We don't use # to avoid carrier USSD blocks
  });

  // Play a silent 1-second 'Wait' beep to let the commas finish sending
  gather.play({ digits: 'w' }); 

  res.type('text/xml').send(twiml.toString());
});

// ==========================================
// ⚡ 3. VOICE EXECUTION (Process Tx)
// ==========================================
app.post("/voice/process-tx", async (req, res) => {
  const digits = req.body.Digits; 
  const senderPhone = req.body.From.replace('+', '');
  const twiml = new VoiceResponse();

  if (digits && digits.includes('*')) {
    const [amount, recipientPhone] = digits.split('*');

    const sender = getWallet(senderPhone);
    const recipient = getWallet(recipientPhone);

    if (!recipient) {
      twiml.say("Recipient wallet not found.");
      console.log(`❌ Voice Tx Failed: Recipient ${recipientPhone} not found.`);
    } else {
      try {
        console.log(`💸 Voice Tx Initiated: ${amount} STRK | ${senderPhone} -> ${recipientPhone}`);

        // 1. Decrypt key using the demo PIN
        const privateKey = decryptKey(sender.encryptedKey, DEFAULT_PIN);

        // 2. Fire the Starknet Transaction (Defaulting to STRK for voice)
        const txHash = await sendTokens(privateKey, recipient.address, amount, "STRK", { getWallet });

        console.log(`✅ Voice Tx Success! Hash: ${txHash}`);
        twiml.say(`Transaction successful. Check WhatsApp for details.`);

        // 3. Send a WhatsApp receipt to the sender automatically!
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: `whatsapp:+${senderPhone}`,
          body: `⚡ *Voice Transfer Complete*\nSent ${amount} STRK to ${recipientPhone}.\nTx Hash: ${txHash}`,
        });

      } catch (err) {
        console.error("Tx Error:", err);
        twiml.say("Transaction failed. Please check your balance.");
      }
    }
  } else {
    twiml.say("Command not recognized.");
  }

  twiml.hangup();
  res.type('text/xml').send(twiml.toString());
});

// ==========================================
// 🚀 SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 StarkZap Unified Node running on port ${PORT}`);
});
