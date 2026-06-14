import type { ProviderType, GatewayProvider } from "./types";
import { openClawProvider } from "./openClawProvider";
import { nanoClawProvider } from "./nanoClawProvider";
import { nullClawProvider } from "./nullClawProvider";
import { zeroClawProvider } from "./zeroClawProvider";
import { openFengProvider } from "./openGangProvider";
import { nemoClawProvider } from "./nemoClawProvider";

const providers = new Map<ProviderType, GatewayProvider>([
  ["openclaw", openClawProvider],
  ["nanoclaw", nanoClawProvider],
  ["nullclaw", nullClawProvider],
  ["zeroclaw", zeroClawProvider],
  ["openfeng", openFengProvider],
  ["nemoclaw", nemoClawProvider],
]);

export function getProvider(type: ProviderType): GatewayProvider {
  return providers.get(type) || openClawProvider;
}

export function getDefaultProvider(): GatewayProvider {
  return openClawProvider;
}

export function getAllProviders(): GatewayProvider[] {
  return Array.from(providers.values());
}

export function registerProvider(provider: GatewayProvider): void {
  providers.set(provider.type, provider);
}
