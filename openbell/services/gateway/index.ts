export { gatewayClient, GatewayClient } from "./gatewayClient";
export { sessionManager } from "./sessionManager";
export { pairingService } from "./pairingService";
export { getDeviceIdentity } from "./deviceIdentity";
export * from "./gatewayProtocol";
export { makeIdempotencyKey } from "./idempotency";
export { getProvider, getDefaultProvider, getAllProviders, registerProvider } from "./providers";
export type { ProviderType, GatewayProvider, ConnectContext } from "./providers";
