import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

function masterKey(): Buffer {
  const raw = process.env.SECRET_VAULT_KEY;
  if (!raw || raw.trim().length < 16) {
    throw new Error("SECRET_VAULT_KEY chưa đặt (cần chuỗi ngẫu nhiên >= 32 ký tự).");
  }
  return createHash("sha256").update(raw.trim()).digest();
}

export function hasMasterKey(): boolean {
  const raw = process.env.SECRET_VAULT_KEY;
  return !!(raw && raw.trim().length >= 16);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function last4(s: string): string {
  const t = (s || "").trim();
  return t.length <= 4 ? t : t.slice(-4);
}
