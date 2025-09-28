import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export default class Encryption {
  static async encrypt(text: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      process.env.NEXT_SECRET_KEY!,
      iv
    );
    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return (
      iv.toString("hex") +
      ":" +
      tag.toString("hex") +
      ":" +
      encrypted.toString("hex")
    );
  }
  static async decrypt(encryptedText: string) {
    const [ivHex, tagHex, dataHex] = encryptedText.split(":");
    if (!ivHex || !tagHex || !dataHex) return undefined;

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      process.env.NEXT_SECRET_KEY!,
      iv
    );
    decipher.setAuthTag(tag);
    return (
      decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8")
    );
  }

  static sha256 = (s: string) =>
    crypto.createHash("sha256").update(s).digest("hex");
  static genKey = () => crypto.randomBytes(32).toString("hex");
}
