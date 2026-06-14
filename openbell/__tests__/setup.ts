// ─── Test Setup ──────────────────────────────────────────────────────────────
// Mock native modules that aren't available in the Jest environment.

// Expo SDK 55 runtime uses import.meta & dynamic imports for polyfills.
// Stub the globals it expects so the setup files don't crash.
if (typeof globalThis.__ExpoImportMetaRegistry === "undefined") {
  (globalThis as any).__ExpoImportMetaRegistry = {};
}
// Provide structuredClone if the runtime hasn't injected it yet (Node <17)
if (typeof globalThis.structuredClone === "undefined") {
  (globalThis as any).structuredClone = (val: any) => JSON.parse(JSON.stringify(val));
}

// Block Expo's winter runtime from trying to dynamically import polyfills
jest.mock("expo/src/winter/runtime.native", () => ({}));
jest.mock("expo/src/winter/installGlobal", () => ({}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => `test-uuid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock("expo-linking", () => ({
  createURL: jest.fn((path: string) => `clawmobile://${path}`),
  openURL: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "ExponentPushToken[test]" }),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 4, MAX: 5 },
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

// Mock the gateway client singleton
const mockGatewayClient = {
  onMessage: jest.fn(() => jest.fn()), // returns unsubscribe fn
  onStatus: jest.fn(() => jest.fn()),
  request: jest.fn(),
  send: jest.fn(() => true),
  connect: jest.fn(),
  disconnect: jest.fn(),
  getStatus: jest.fn(() => "connected"),
  getConfig: jest.fn(() => null),
};

jest.mock("@/services/gateway/gatewayClient", () => ({
  gatewayClient: mockGatewayClient,
  GatewayClient: jest.fn(() => mockGatewayClient),
}));

jest.mock("@/services/gateway", () => ({
  gatewayClient: mockGatewayClient,
  makeIdempotencyKey: jest.fn((id: string) => `idem_${id}`),
  pairingService: {
    loadGateways: jest.fn().mockResolvedValue([]),
    start: jest.fn(),
    stop: jest.fn(),
    onChallenge: jest.fn(() => jest.fn()),
    createGatewayConfig: jest.fn(),
    saveGateway: jest.fn(),
    removeGateway: jest.fn(),
  },
}));

jest.mock("@/services/gateway/providers/registry", () => ({
  getProvider: jest.fn(() => ({
    buildChatSend: jest.fn((session: string, content: string) => ({
      method: "chat.send",
      params: { sessionKey: session, content },
    })),
    buildChatHistory: jest.fn(),
    extractText: jest.fn((msg: any) => msg?.content?.[0]?.text || ""),
    agentDiscoveryMethods: jest.fn(() => ["node.list"]),
    parseAgents: jest.fn(() => []),
    mapEvent: jest.fn(),
    buildConnectParams: jest.fn(),
    handleConnectResult: jest.fn(),
  })),
}));

jest.mock("@/services/gateway/deviceIdentity", () => ({
  getDeviceIdentity: jest.fn().mockResolvedValue({ publicKey: "test", secretKey: "test" }),
  buildSignatureMessage: jest.fn(() => "sig"),
  signMessage: jest.fn().mockResolvedValue("signature"),
}));

// Export for test access
(global as any).__mockGatewayClient = mockGatewayClient;
