import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function getKey(pin) {
  return scryptSync(pin, "starkzap-salt", 32);
}

export function encryptKey(privateKey, pin) {
  const key = getKey(pin);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptKey(encryptedKey, pin) {
  try {
    const [ivHex, encryptedHex] = encryptedKey.split(":");
    const key = getKey(pin);
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("❌ Wrong PIN — action cancelled.");
  }
}