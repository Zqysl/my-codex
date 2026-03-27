import { Decrypter, Encrypter, armor } from "age-encryption";

import { parseProfileText, serializeProfile, type CodexProfile } from "./profile.js";

function assertPassphrase(passphrase: string): string {
  if (passphrase.length === 0) {
    throw new Error("Passphrase cannot be empty.");
  }

  return passphrase;
}

export async function encryptProfile(
  profile: CodexProfile,
  passphrase: string,
): Promise<string> {
  const encrypter = new Encrypter();
  encrypter.setPassphrase(assertPassphrase(passphrase));
  const ciphertext = await encrypter.encrypt(serializeProfile(profile));
  return armor.encode(ciphertext);
}

export async function decryptProfile(
  encryptedText: string,
  passphrase: string,
): Promise<CodexProfile> {
  let decoded: Uint8Array;

  try {
    decoded = armor.decode(encryptedText.trim());
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse age file: ${reason}`);
  }

  const decrypter = new Decrypter();
  decrypter.addPassphrase(assertPassphrase(passphrase));

  try {
    const plaintext = await decrypter.decrypt(decoded, "text");
    return parseProfileText(plaintext);
  } catch {
    throw new Error("Failed to decrypt profile. Check that the passphrase is correct.");
  }
}
