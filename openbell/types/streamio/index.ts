// StreamIO auth types
export interface StreamIOAuth {
  email: string;
  authToken: string | null;
  isAuthenticated: boolean;
  expiresAt: string | null; // ISO date string
  subscriptionTier: StreamIOSubscriptionTier;
}

export type StreamIOSubscriptionTier = 'free' | 'pro' | 'enterprise';

// HLS streaming types
export interface HLSConfig {
  segmentDuration: number;
  playlistSize: number;
  resolution: string;
  bitrate: number;
  transcodingMode: TranscodingMode;
}

export type TranscodingMode = 'onDevice' | 'serverSide' | 'auto';
export type HLSStatus = 'idle' | 'starting' | 'streaming' | 'stopping' | 'error';
export type TunnelStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface StreamStatus {
  id: string;
  status: HLSStatus;
  segmentCount: number;
  startedAt: string | null;
  url: string | null;
}

export interface StreamInfo {
  id: string;
  name: string;
  type: 'screen' | 'camera' | 'composite';
  isActive: boolean;
  viewerCount: number;
}

// Onboarding types
export type CapturePreference = 'screen' | 'camera' | 'both';
export type QualityPreset = 'low' | 'medium' | 'high' | 'custom';

// AI Message types (from Electron AIConnectionManager)
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: AIMessageMetadata;
  timestamp: string;
}

export interface AIMessageMetadata {
  ocrText?: string;
  selectedText?: string;
  imageBytes?: string;
  analysisType?: AnalysisType;
}

export type AnalysisType = 'property' | 'trading';

export interface AIRequest {
  messages: AIMessage[];
  imageBytes?: string;
  smarterAnalysisEnabled: boolean;
}

export interface AIResponse {
  content: string;
  isComplete: boolean;
}

// Feature / permission / notification types
export type AIFeature = 'propertyAnalysis' | 'tradingAnalysis' | 'tts' | 'stt';
export type NotificationType = 'streamAlerts' | 'analysisComplete' | 'viewerMilestones' | 'system';
export type Permission = 'camera' | 'microphone' | 'screenCapture' | 'notifications';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}
