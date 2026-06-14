import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type { KeyPairInfo } from "@/types/encryption";

const KEY_INDEX_STORAGE = "e2e_key_index";
const KEY_PREFIX = "e2e_key_";

/**
 * Manages E2E encryption keys.
 *
 * Uses AES-256-GCM for symmetric encryption. During pairing, the app and
 * Gateway perform a key exchange to derive a shared secret.
 *
 * Keys are stored in expo-secure-store (hardware-backed on iOS/Android).
 */
class KeyManager {
  /** Generate a new AES encryption key for a gateway. */
  async generateKey(gatewayId: string): Promise<Crypto.AESEncryptionKey> {
    const key = await Crypto.AESEncryptionKey.generate(256);

    // Store the key material securely
    const keyBase64 = await key.encoded("base64");
    await SecureStore.setItemAsync(`${KEY_PREFIX}${gatewayId}`, keyBase64);

    // Update key index
    const info: KeyPairInfo = {
      gatewayId,
      publicKeyBase64: keyBase64.slice(0, 16) + "...", // Truncated for display only
      createdAt: new Date().toISOString(),
      verified: false,
    };
    await this.saveKeyInfo(info);

    return key;
  }

  /** Load an existing AES key for a gateway. Returns null if not found. */
  async loadKey(gatewayId: string): Promise<Crypto.AESEncryptionKey | null> {
    const keyBase64 = await SecureStore.getItemAsync(`${KEY_PREFIX}${gatewayId}`);
    if (!keyBase64) return null;

    return Crypto.AESEncryptionKey.import(keyBase64, "base64");
  }

  /** Delete a key for a gateway. */
  async deleteKey(gatewayId: string): Promise<void> {
    await SecureStore.deleteItemAsync(`${KEY_PREFIX}${gatewayId}`);
    await this.removeKeyInfo(gatewayId);
  }

  /** Rotate the key for a gateway. */
  async rotateKey(gatewayId: string): Promise<Crypto.AESEncryptionKey> {
    await this.deleteKey(gatewayId);
    return this.generateKey(gatewayId);
  }

  /** Get key info for all gateways. */
  async getAllKeyInfo(): Promise<KeyPairInfo[]> {
    try {
      const json = await SecureStore.getItemAsync(KEY_INDEX_STORAGE);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  /** Get key info for a specific gateway. */
  async getKeyInfo(gatewayId: string): Promise<KeyPairInfo | null> {
    const all = await this.getAllKeyInfo();
    return all.find((k) => k.gatewayId === gatewayId) || null;
  }

  /** Mark a key as verified (user confirmed safety number). */
  async markVerified(gatewayId: string): Promise<void> {
    const all = await this.getAllKeyInfo();
    const info = all.find((k) => k.gatewayId === gatewayId);
    if (info) {
      info.verified = true;
      await SecureStore.setItemAsync(KEY_INDEX_STORAGE, JSON.stringify(all));
    }
  }

  /** Check if a gateway has an encryption key. */
  async hasKey(gatewayId: string): Promise<boolean> {
    const key = await SecureStore.getItemAsync(`${KEY_PREFIX}${gatewayId}`);
    return key !== null;
  }

  /**
   * Generate a safety number fingerprint for key verification.
   * Both parties compute this from the shared key — if they match, no MITM.
   */
  async generateSafetyNumber(gatewayId: string): Promise<string[] | null> {
    const keyBase64 = await SecureStore.getItemAsync(`${KEY_PREFIX}${gatewayId}`);
    if (!keyBase64) return null;

    // Hash the key to produce a fingerprint
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      keyBase64 + gatewayId
    );

    // Split into 8 blocks of 8 characters for easy comparison
    const blocks: string[] = [];
    for (let i = 0; i < 64; i += 8) {
      blocks.push(hash.slice(i, i + 8).toUpperCase());
    }

    return blocks;
  }

  // --- Internal ---

  private async saveKeyInfo(info: KeyPairInfo): Promise<void> {
    const all = await this.getAllKeyInfo();
    const idx = all.findIndex((k) => k.gatewayId === info.gatewayId);
    if (idx >= 0) {
      all[idx] = info;
    } else {
      all.push(info);
    }
    await SecureStore.setItemAsync(KEY_INDEX_STORAGE, JSON.stringify(all));
  }

  private async removeKeyInfo(gatewayId: string): Promise<void> {
    const all = await this.getAllKeyInfo();
    const filtered = all.filter((k) => k.gatewayId !== gatewayId);
    await SecureStore.setItemAsync(KEY_INDEX_STORAGE, JSON.stringify(filtered));
  }
}

export const keyManager = new KeyManager();
