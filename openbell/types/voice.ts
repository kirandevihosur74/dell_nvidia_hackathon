export interface VoiceState {
  isRecording: boolean;
  isPlaying: boolean;
  transcription: string;
  error: string | null;
}
