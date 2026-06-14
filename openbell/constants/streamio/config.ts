// StreamIO API configuration — all StreamIO network requests use these endpoints
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';

function getDevHost(): string {
  function extractIP(host: string | undefined): string | null {
    if (!host) return null;
    const ip = host.split(':')[0];
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
    return null;
  }

  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;
  const fromConstants = extractIP(debuggerHost);
  if (fromConstants) return fromConstants;

  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptURL) {
    const match = scriptURL.match(/\/\/(\d+\.\d+\.\d+\.\d+)/);
    if (match) return match[1];
  }

  return '10.213.185.134';
}

const DEV_HOST = __DEV__ ? getDevHost() : '';

// Set to your local backend URL for development (empty = use api.streamio.ai)
const DEV_TUNNEL_BACKEND: string = __DEV__ ? '' : '';

export const StreamIOAPIConfig = {
  baseURL: DEV_TUNNEL_BACKEND || 'https://api.streamio.ai',
  wsURL: DEV_TUNNEL_BACKEND
    ? DEV_TUNNEL_BACKEND.replace('https://', 'wss://').replace('http://', 'ws://')
    : 'wss://api.streamio.ai',

  endpoints: {
    auth: '/api/v1/auth',
    users: '/api/v1/users',

    ai: '/api/v1/ai',
    aiChat: '/api/v1/ai/chat',
    aiAnalyzeScreen: '/api/v1/ai/analyze-screen',

    liveScreen: '/api/v1/live-screen',
    liveScreenStart: '/api/v1/live-screen/start',
    liveScreenSessions: '/api/v1/live-screen/user/sessions',
    liveScreenStats: '/api/v1/live-screen/stats',

    chatWS: '/horizon/assist/chat-ws',
    liveScreenWS: '/live-screen',

    conversations: '/api/v1/conversations',
    media: '/api/v1/media',
    analytics: '/api/v1/analytics',
    streams: '/api/v1/streams',
    health: '/api/v1/health',

    inferenceSubmit: '/api/v1/inference/submit',
    inferencePipelines: '/api/v1/inference/pipelines',
    inferenceAgents: '/api/v1/inference/agents',
    inferenceWS: '/api/v1/inference/ws',
    inferenceBudget: '/api/v1/inference/streams',
    inferenceViewerState: '/api/v1/inference/streams',

    // Recall.ai Meeting Bot
    recallDeployBot: '/api/v1/recall/bot',
    recallActiveBot: '/api/v1/recall/bot/active',
    recallValidateUrl: '/api/v1/recall/validate-url',

    // Messenger
    messengerChannels: '/api/v1/messenger/channels',
    messengerMessages: '/api/v1/messenger/messages',
    messengerUsers: '/api/v1/messenger/users',
    messengerThreads: '/api/v1/messenger/threads',
    messengerDMs: '/api/v1/messenger/dms',
  },

  qa: {
    endpoint: '/api/v1/inference/ask',
    maxConversationTurns: 10,
    maxResponseTokens: 300,
    processingTimeoutMs: 60000,
  },

  external: {
    elevenLabsTTS: 'https://api.elevenlabs.io/v1/text-to-speech',
    elevenLabsSTT: 'https://api.elevenlabs.io/v1/speech-to-text',
    elevenLabsWSS: 'wss://api.elevenlabs.io/v1/text-to-speech',
    kindeDomain: 'https://optimumvertex.kinde.com',
    kindeClientId: 'ab506e5762154d42a8453a8646881b0b',
  },

  timeouts: {
    standard: 30000,
    extended: 60000,
    websocket: 120000,
    upload: 120000,
  },
};

export const StreamIODefaults = {
  segmentDuration: 4,
  playlistSize: 10,
  resolution: '1920x1080',
  bitrate: 1500000,
  frameRate: 30,
};
