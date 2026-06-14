import { aesEncryptAsync, aesDecryptAsync, AESSealedData } from "expo-crypto";
import { keyManager } from "./keyManager";
import type { EncryptedPayload } from "@/types/encryption";
import type { GatewayMessage } from "@/types/gateway";

/**
 * End-to-end encryption service for Gateway messages.
 *
 * Uses AES-256-GCM with per-message random IVs.
 * Keys are exchanged during the pairing flow and stored in secure hardware.
 */
class E2EService {
  private enabled = false;

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Enable E2E encryption for a specific gateway. */
  async enable(gatewayId: string): Promise<boolean> {
    const hasKey = await keyManager.hasKey(gatewayId);
    if (!hasKey) {
      await keyManager.generateKey(gatewayId);
    }
    this.enabled = true;
    return true;
  }

  /** Disable E2E encryption. */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Encrypt a message payload before sending to the Gateway.
   */
  async encryptMessage(gatewayId: string, msg: GatewayMessage): Promise<GatewayMessage> {
    if (!this.enabled) return msg;

    const key = await keyManager.loadKey(gatewayId);
    if (!key) return msg;

    const plaintext = JSON.stringify(msg.payload || {});
    const plaintextBytes = new TextEncoder().encode(plaintext);

    const sealed = await aesEncryptAsync(plaintextBytes, key);
    const sealedBase64 = await sealed.combined("base64") as string;

    const encryptedPayload: EncryptedPayload = {
      sealed: sealedBase64,
      keyId: gatewayId,
      timestamp: new Date().toISOString(),
    };

    return {
      ...msg,
      payload: {
        encrypted: true,
        data: encryptedPayload,
      },
    };
  }

  /**
   * Decrypt an incoming message payload from the Gateway.
   */
  async decryptMessage(gatewayId: string, msg: GatewayMessage): Promise<GatewayMessage> {
    if (!this.enabled) return msg;

    const payload = msg.payload;
    if (!payload?.encrypted) return msg;

    const key = await keyManager.loadKey(gatewayId);
    if (!key) return msg;

    try {
      const encData = payload.data as EncryptedPayload;
      const sealedData = AESSealedData.fromCombined(encData.sealed);

      const decryptedBytes = await aesDecryptAsync(sealedData, key);
      const decryptedText = new TextDecoder().decode(decryptedBytes as Uint8Array);
      const decryptedPayload = JSON.parse(decryptedText);

      return {
        ...msg,
        payload: decryptedPayload,
      };
    } catch {
      return {
        ...msg,
        payload: {
          ...payload,
          decryptionFailed: true,
        },
      };
    }
  }

  /**
   * Encrypt a string for local storage.
   */
  async encryptForStorage(gatewayId: string, data: string): Promise<string> {
    const key = await keyManager.loadKey(gatewayId);
    if (!key) return data;

    const plainBytes = new TextEncoder().encode(data);
    const sealed = await aesEncryptAsync(plainBytes, key);
    return await sealed.combined("base64") as string;
  }

  /**
   * Decrypt a string from local storage.
   */
  async decryptFromStorage(gatewayId: string, encryptedBase64: string): Promise<string> {
    const key = await keyManager.loadKey(gatewayId);
    if (!key) return encryptedBase64;

    try {
      const sealedData = AESSealedData.fromCombined(encryptedBase64);
      const decrypted = await aesDecryptAsync(sealedData, key);
      return new TextDecoder().decode(decrypted as Uint8Array);
    } catch {
      return encryptedBase64;
    }
  }
}

export const e2eService = new E2EService();
