import { readFileSync, writeFileSync, existsSync } from "fs";

const DB = "./wallets.json";
const SESSIONS = "./sessions.json";

function load(path) {
  if (!existsSync(path)) writeFileSync(path, "{}");
  return JSON.parse(readFileSync(path));
}

function save(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

export function getWallet(phone) {
  return load(DB)[phone] || null;
}

export function saveWallet(phone, address, encryptedKey) {
  const db = load(DB);
  db[phone] = { address, encryptedKey };
  save(DB, db);
}

export function getSession(phone) {
  return load(SESSIONS)[phone] || { step: "menu", data: {} };
}

export function saveSession(phone, session) {
  const sessions = load(SESSIONS);
  sessions[phone] = session;
  save(SESSIONS, sessions);
}

export function clearSession(phone) {
  const sessions = load(SESSIONS);
  sessions[phone] = { step: "menu", data: {} };
  save(SESSIONS, sessions);
}