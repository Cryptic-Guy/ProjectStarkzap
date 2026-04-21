import { handleCommand } from "./commands.js";
import * as readline from "readline";
import crypto from "crypto"; // Added for unique ID generation

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ✅ CHANGE: Instead of "testuser123", we generate a unique ID every time you start
// This ensures a brand new wallet is created in your JSON for every run.
const phone = `user_${crypto.randomBytes(3).toString('hex')}`;

console.log("-------------------------------------------");
console.log("🤖 StarkZap Bot Console");
console.log(`🆔 Active Session ID: ${phone}`);
console.log("Type your messages below (Ctrl+C to exit)");
console.log("-------------------------------------------\n");

// show menu on start
try {
  const welcome = await handleCommand(phone, "hi");
  // Clean up HTML tags for terminal visibility
  const cleanWelcome = welcome.replace(/<[^>]*>/g, ''); 
  console.log(`🤖 Bot:\n${cleanWelcome}\n`);
} catch (err) {
  console.error("❌ Startup Error:", err.message);
}

rl.on("line", async (input) => {
  if (!input.trim()) return;

  try {
    const reply = await handleCommand(phone, input.trim());
    // Clean up HTML tags for terminal visibility
    const cleanReply = reply.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');

    console.log(`\n🤖 Bot:\n${cleanReply}\n`);
  } catch (err) {
    console.log(`\n❌ Error: ${err.message}\n`);
  }
});

rl.on("close", () => {
  console.log("\n👋 Bye!");
  process.exit(0);
});