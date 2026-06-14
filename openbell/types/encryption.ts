export interface KeyPairInfo {
  gatewayId: string;
  publicKeyBase64: string;
  createdAt: string;
  rotatedAt?: string;
  verified: boolean;
}

export interface SafetyNumber {
  gatewayId: string;
  fingerprint: string;
  blocks: string[];
}

export interface EncryptedPayload {
  /** Base64-encoded IV + ciphertext + tag */
  sealed: string;
  /** Key ID used for encryption */
  keyId: string;
  /** Timestamp of encryption */
  timestamp: string;
}
