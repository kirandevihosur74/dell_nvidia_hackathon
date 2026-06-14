import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";

// Ensure globalThis.crypto.getRandomValues exists for @noble/ed25519
if (typeof globalThis.crypto === "undefined") {
  (globalThis as any).crypto = {};
}
if (typeof globalThis.crypto.getRandomValues === "undefined") {
  globalThis.crypto.getRandomValues = ExpoCrypto.getRandomValues as any;
}

// @noble/ed25519's async methods use hashes.sha512Async which defaults to crypto.subtle.
// React Native doesn't have crypto.subtle, so we must override it BEFORE using any ed25519 functions.
import { etc, hashes, utils, getPublicKeyAsync, signAsync } from "@noble/ed25519";

// SHA-512 implementation using expo-crypto
const sha512ExpoCrypto = async (...messages: Uint8Array[]): Promise<Uint8Array> => {
  let totalLen = 0;
  for (const m of messages) totalLen += m.length;
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const m of messages) {
    combined.set(m, offset);
    offset += m.length;
  }

  const result = await ExpoCrypto.digest(
    ExpoCrypto.CryptoDigestAlgorithm.SHA512,
    combined as any
  );
  return new Uint8Array(result);
};

// Override both hashes.sha512Async (used by getPublicKeyAsync, signAsync)
// and etc.sha512Async
(hashes as any).sha512Async = sha512ExpoCrypto;
(etc as any).sha512Async = sha512ExpoCrypto;

const DEVICE_IDENTITY_KEY = "openclaw-device-identity-v2";

export interface DeviceIdentity {
  deviceId: string;
  publicKey: string;   // base64url encoded
  privateKey: string;  // base64url encoded
}

// --- Base64url helpers ---

function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(str: string): Uint8Array {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  b64 += "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256hex(data: Uint8Array): Promise<string> {
  const result = await ExpoCrypto.digest(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    data as any
  );
  return toHex(new Uint8Array(result));
}

/**
 * Get or create a persistent device identity (Ed25519 keypair).
 */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  // Try to load existing identity
  try {
    const stored = await SecureStore.getItemAsync(DEVICE_IDENTITY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DeviceIdentity;
      if (parsed.deviceId && parsed.publicKey && parsed.privateKey) {
        return parsed;
      }
    }
  } catch {
    // ignore, generate new
  }

  // Generate new Ed25519 keypair
  const privateKeyBytes = utils.randomSecretKey();
  const publicKeyBytes = await getPublicKeyAsync(privateKeyBytes);

  const deviceId = await sha256hex(publicKeyBytes);
  const publicKey = toBase64url(publicKeyBytes);
  const privateKey = toBase64url(privateKeyBytes);

  const identity: DeviceIdentity = { deviceId, publicKey, privateKey };

  // Persist in SecureStore
  await SecureStore.setItemAsync(DEVICE_IDENTITY_KEY, JSON.stringify(identity)).catch(() => {});

  return identity;
}

/**
 * Build the canonical message string for signing.
 * Must match the Gateway's Vm() function exactly:
 * "v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce"
 */
export function buildSignatureMessage(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string;
}): string {
  const scopeStr = params.scopes.join(",");
  const tokenStr = params.token ?? "";
  return [
    "v2",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopeStr,
    String(params.signedAtMs),
    tokenStr,
    params.nonce,
  ].join("|");
}

/**
 * Sign a message with the device's private key (Ed25519).
 */
export async function signMessage(
  privateKeyBase64url: string,
  message: string
): Promise<string> {
  const privateKeyBytes = fromBase64url(privateKeyBase64url);
  const messageBytes = new TextEncoder().encode(message);
  const signature = await signAsync(messageBytes, privateKeyBytes);
  return toBase64url(signature);
}
