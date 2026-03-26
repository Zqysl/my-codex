import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { parseProfileText, serializeProfile, type CodexProfile } from "./profile.js";

const FORMAT = "my-codex.profile.v1";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

export interface EncryptedProfileEnvelope {
  format: typeof FORMAT;
  kdf: {
    name: "scrypt";
    salt: string;
    keyLength: number;
  };
  cipher: {
    name: "aes-256-gcm";
    iv: string;
    tag: string;
  };
  ciphertext: string;
}

function deriveKey(passphrase: string, salt: Buffer, keyLength: number): Buffer {
  if (passphrase.length === 0) {
    throw new Error("Passphrase cannot be empty.");
  }

  return scryptSync(passphrase, salt, keyLength);
}

function encodeBase64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

function decodeBase64(value: string, label: string): Buffer {
  try {
    return Buffer.from(value, "base64");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${label}: ${reason}`);
  }
}

export function encryptProfile(
  profile: CodexProfile,
  passphrase: string,
): EncryptedProfileEnvelope {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt, KEY_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = serializeProfile(profile);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    format: FORMAT,
    kdf: {
      name: "scrypt",
      salt: encodeBase64(salt),
      keyLength: KEY_LENGTH,
    },
    cipher: {
      name: "aes-256-gcm",
      iv: encodeBase64(iv),
      tag: encodeBase64(tag),
    },
    ciphertext: encodeBase64(ciphertext),
  };
}

export function decryptProfile(
  envelope: EncryptedProfileEnvelope,
  passphrase: string,
): CodexProfile {
  if (envelope.format !== FORMAT) {
    throw new Error(`Unsupported encrypted profile format: ${String(envelope.format)}.`);
  }

  if (envelope.kdf.name !== "scrypt") {
    throw new Error(`Unsupported key derivation: ${envelope.kdf.name}.`);
  }

  if (envelope.cipher.name !== "aes-256-gcm") {
    throw new Error(`Unsupported cipher: ${envelope.cipher.name}.`);
  }

  const salt = decodeBase64(envelope.kdf.salt, "kdf salt");
  const iv = decodeBase64(envelope.cipher.iv, "cipher iv");
  const tag = decodeBase64(envelope.cipher.tag, "cipher tag");
  const ciphertext = decodeBase64(envelope.ciphertext, "ciphertext");
  const key = deriveKey(passphrase, salt, envelope.kdf.keyLength);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Failed to decrypt profile. Check that the passphrase is correct.");
  }

  return parseProfileText(plaintext.toString("utf8"));
}

export function serializeEnvelope(envelope: EncryptedProfileEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

export function parseEnvelopeText(input: string): EncryptedProfileEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse encrypted profile JSON: ${reason}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Encrypted profile must be an object.");
  }

  const envelope = parsed as Partial<EncryptedProfileEnvelope>;
  if (
    typeof envelope.format !== "string" ||
    typeof envelope.ciphertext !== "string" ||
    typeof envelope.kdf?.name !== "string" ||
    typeof envelope.kdf?.salt !== "string" ||
    typeof envelope.kdf?.keyLength !== "number" ||
    typeof envelope.cipher?.name !== "string" ||
    typeof envelope.cipher?.iv !== "string" ||
    typeof envelope.cipher?.tag !== "string"
  ) {
    throw new Error("Encrypted profile JSON is missing required fields.");
  }

  return {
    format: envelope.format,
    kdf: {
      name: envelope.kdf.name,
      salt: envelope.kdf.salt,
      keyLength: envelope.kdf.keyLength,
    },
    cipher: {
      name: envelope.cipher.name,
      iv: envelope.cipher.iv,
      tag: envelope.cipher.tag,
    },
    ciphertext: envelope.ciphertext,
  };
}
