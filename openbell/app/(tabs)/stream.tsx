import React, { useState, useEffect, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  StatusBar,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useStream } from '@/hooks/streamio/useStream';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { StreamPreview } from '@/components/streamio/stream/StreamPreview';
import { StreamStats } from '@/components/streamio/stream/StreamStats';
import { StreamShareSheet } from '@/components/streamio/stream/StreamShareSheet';
import { InferenceChatFeed } from '@/components/streamio/inference/InferenceChatFeed';
import { AgentTogglePanel, AgentToggleButton } from '@/components/streamio/inference/AgentTogglePanel';
import { AgentPicker } from '@/components/streamio/inference/AgentPicker';
import { PipelineBuilder } from '@/components/streamio/inference/PipelineBuilder';
import { AgentSettings } from '@/components/streamio/inference/AgentSettings';
import { PipelinePresets } from '@/components/streamio/inference/PipelinePresets';
import * as PipelineService from '@/services/streamio/pipelineService';
import * as InferenceService from '@/services/streamio/inferenceService';
import { getAgentById, updateAgent } from '@/services/streamio/agentRegistry';
import { InferenceAgent } from '@/types/streamio/inference';
import { MicFAB } from '@/components/streamio/stream/MicFAB';
import { QAVoicePicker } from '@/components/streamio/stream/QAVoicePicker';
import { useLiveQA } from '@/hooks/streamio/useLiveQA';
import { formatBitrate, fetchPastStreams, PastStream, formatDuration } from '@/services/streamio/streamService';
import { StreamDetailModal } from '@/components/streamio/stream/StreamDetailModal';
import {
  Settings,
  Play,
  Square,
  AlertCircle,
  ChevronRight,
  Clock,
  Film,
  Bot,
} from 'lucide-react-native';
import { useMeetingBotStore } from '@/stores/meetingBotStore';

export default function StreamScreen() {
  const stream = useStream();
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const inferenceStatus = useStreamIOInferenceStore((s) => s.status);
  const agentStates = useStreamIOInferenceStore((s) => s.agentStates);
  const [showShare, setShowShare] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pastStreams, setPastStreams] = useState<PastStream[]>([]);
  const [pastStreamsLoading, setPastStreamsLoading] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [selectedStream, setSelectedStream] = useState<PastStream | null>(null);

  const isFocused = useIsFocused();
  const { qaStatus, qaSessionActive, micAvailable, startRecording, stopRecording, interrupt } = useLiveQA();
  const inferenceEnabled = stream.isStreaming && inferenceStatus === 'active';

  // Meeting bot state — for inference routing indicator
  const meetingBotStatus = useMeetingBotStore((s) => s.status);
  const meetingBotRouting = useMeetingBotStore((s) => s.routingMode);
  const meetingBotActive = (meetingBotStatus === 'recording') &&
    (meetingBotRouting === 'inference' || meetingBotRouting === 'both');

  // Memory management: pause camera when tab is unfocused
  useEffect(() => {
    if (!isFocused && stream.isStreaming) {
      // Camera will auto-pause via cameraActive={false} in preview
      // WebSocket and HLS continue in background (stream stays live)
    }
  }, [isFocused, stream.isStreaming]);

  // Fetch past streams when idle
  useEffect(() => {
    if (!stream.isStreaming && !stream.isStarting) {
      setPastStreamsLoading(true);
      fetchPastStreams(1, 10)
        .then(({ streams }) => setPastStreams(streams))
        .catch(() => setPastStreams([]))
        .finally(() => setPastStreamsLoading(false));
    }
  }, [stream.isStreaming, stream.isStarting]);

  const activeAgentCount = Object.keys(agentStates).length;
  const pipelines = PipelineService.getPipelines();
  const activePipelineId = PipelineService.getActivePipelineId();
  const activePipeline = activePipelineId ? PipelineService.getPipelineById(activePipelineId) : undefined;

  const actualResolution = useStreamIOStreamStore((s) => s.actualResolution);
  const throughputBps = useStreamIOStreamStore((s) => s.throughputBps);

  const bitrate = stream.isStreaming && throughputBps > 0
    ? formatBitrate(Math.round(throughputBps * 8))
    : formatBitrate(stream.config.bitrate);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleToggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId];
      if (next.length > 0) {
        if (activePipeline) {
          PipelineService.updatePipeline(activePipeline.id, {
            stages: [{ stageIndex: 0, agents: next, mergeStrategy: 'concat', passContextToNext: false }],
          });
        } else {
          const pipeline = PipelineService.createParallelPipeline('Quick Setup', next);
          PipelineService.setActivePipelineId(pipeline.id);
        }
        useStreamIOStreamStore.getState().setInferenceEnabled(true);

        const streamStatus = useStreamIOStreamStore.getState().status;
        const infStatus = useStreamIOInferenceStore.getState().status;
        if (streamStatus === 'streaming' && infStatus !== 'active') {
          InferenceService.startInference().catch((err) => {
            console.warn('[StreamIO] Mid-stream inference start failed:', err);
          });
        }
      } else {
        useStreamIOStreamStore.getState().setInferenceEnabled(false);
        InferenceService.stopInference();
      }
      return next;
    });
  };

  const handleSelectPipeline = (pipelineId: string) => {
    PipelineService.setActivePipelineId(pipelineId);
    const pipeline = PipelineService.getPipelineById(pipelineId);
    if (pipeline) {
      const allAgentIds = pipeline.stages.flatMap((s) => s.agents);
      setSelectedAgentIds(allAgentIds);
      useStreamIOStreamStore.getState().setInferenceEnabled(true);
      useStreamIOStreamStore.getState().setActivePipelineId(pipelineId);
    }
  };

  const handleCreatePipeline = () => {
    if (selectedAgentIds.length === 0) {
      console.warn('[StreamIO] Select agents first');
      return;
    }
    PipelineService.createParallelPipeline(
      `Pipeline ${pipelines.length + 1}`,
      selectedAgentIds,
    );
  };

  const handleDeletePipeline = (pipelineId: string) => {
    Alert.alert('Delete Pipeline', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          PipelineService.deletePipeline(pipelineId);
          if (activePipelineId === pipelineId) {
            setSelectedAgentIds([]);
            useStreamIOStreamStore.getState().setInferenceEnabled(false);
          }
        },
      },
    ]);
  };

  const handleMoveStage = (from: number, to: number) => {
    if (activePipeline) PipelineService.moveStage(activePipeline.id, from, to);
  };

  const handleRemoveAgentFromPipeline = (stageIndex: number, agentId: string) => {
    if (activePipeline) {
      PipelineService.removeAgentFromStage(activePipeline.id, stageIndex, agentId);
      setSelectedAgentIds((prev) => prev.filter((id) => id !== agentId));
    }
  };

  const handleAddStage = () => {
    if (!activePipeline) return;
    PipelineService.updatePipeline(activePipeline.id, {
      stages: [
        ...activePipeline.stages,
        { stageIndex: activePipeline.stages.length, agents: [], mergeStrategy: 'concat', passContextToNext: false },
      ],
    });
  };

  const handleTogglePassContext = (stageIndex: number) => {
    if (!activePipeline) return;
    const stages = [...activePipeline.stages];
    stages[stageIndex] = {
      ...stages[stageIndex],
      passContextToNext: !stages[stageIndex].passContextToNext,
    };
    PipelineService.updatePipeline(activePipeline.id, { stages });
  };

  const [agentSettingsVersion, setAgentSettingsVersion] = useState(0);

  const handleUpdateAgent = (agentId: string, updates: Partial<InferenceAgent>) => {
    updateAgent(agentId, updates);
    setAgentSettingsVersion((v) => v + 1);
  };

  const handleStart = async () => {
    const success = await stream.startStream();
    if (!success) {
      Alert.alert('Stream Error', stream.lastError || 'Failed to start stream');
    }
  };

  const handleStop = async () => {
    await stream.stopStream();
  };

  const handleFlipCamera = () => {
    stream.setCameraPosition(stream.cameraPosition === 'front' ? 'back' : 'front');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View>
          <Text style={[styles.headerSub, { color: theme.textTertiary }]}>
            HLS LIVE STREAMING
          </Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Stream</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Settings size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview Card */}
        <Pressable onPress={stream.isStreaming ? () => setIsFullscreen(true) : undefined}>
          <StreamPreview
            captureSource={stream.captureSource}
            isStreaming={stream.isStreaming}
            cameraPosition={stream.cameraPosition}
            onFlipCamera={handleFlipCamera}
            inferenceEnabled={!isFullscreen && inferenceEnabled}
            cameraActive={!isFullscreen && isFocused}
          />
          {meetingBotActive && (
            <View style={{
              position: 'absolute', top: 8, left: 8, flexDirection: 'row',
              alignItems: 'center', gap: 4, backgroundColor: '#22C55E20',
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
            }}>
              <Bot size={12} color="#22C55E" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#22C55E' }}>Meeting Bot</Text>
            </View>
          )}
          {inferenceEnabled && (
            <AgentToggleButton
              onPress={() => setShowAgentPanel(true)}
              agentCount={activeAgentCount}
            />
          )}
          {stream.isStreaming && qaSessionActive && micAvailable && !isFullscreen && (
            <MicFAB
              visible
              qaStatus={qaStatus}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onInterrupt={interrupt}
            />
          )}
        </Pressable>

        {/* Live Stats */}
        {stream.isStreaming && (
          <StreamStats
            duration={stream.formattedDuration}
            segmentCount={stream.segmentCount}
            viewerCount={stream.viewerCount}
            bitrate={throughputBps > 0 ? formatBitrate(Math.round(throughputBps * 8)) : stream.formattedBitrate}
            resolution={actualResolution || stream.config.resolution}
            transcodingMode={stream.config.transcodingMode}
          />
        )}

        {/* AI Inference Chat Feed */}
        {inferenceEnabled && <InferenceChatFeed />}

        {/* Error */}
        {stream.lastError && (
          <View style={styles.errorContainer}>
            <AlertCircle size={18} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.error }]}>{stream.lastError}</Text>
          </View>
        )}

        {/* Go Live / Stop Button */}
        {stream.isStreaming ? (
          <TouchableOpacity
            style={styles.stopBtn}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert('Stop Stream', 'Are you sure you want to stop streaming?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Stop', style: 'destructive', onPress: handleStop },
              ]);
            }}
          >
            <Square size={20} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.stopBtnText}>Stop Stream</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.goLiveWrap} activeOpacity={0.85} onPress={handleStart}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.goLiveBtn}
            >
              <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.goLiveText}>Go Live</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Helper text */}
        {!stream.isStreaming && (
          <Text style={[styles.helperText, { color: theme.textTertiary }]}>
            You'll be live on your HLS endpoint
          </Text>
        )}

        {/* AI Agent Configuration (pre-stream) */}
        {!stream.isStreaming && (
          <>
            {pipelines.length > 0 && (
              <PipelinePresets
                pipelines={pipelines}
                activePipelineId={activePipelineId}
                onSelect={handleSelectPipeline}
                onCreateNew={handleCreatePipeline}
                onDelete={handleDeletePipeline}
              />
            )}
            <AgentPicker
              selectedAgentIds={selectedAgentIds}
              onToggleAgent={handleToggleAgent}
            />
            {selectedAgentIds.includes('live-qa') && <QAVoicePicker />}
            {activePipeline && selectedAgentIds.length > 0 && (
              <PipelineBuilder
                pipeline={activePipeline}
                onMoveStage={handleMoveStage}
                onRemoveAgent={handleRemoveAgentFromPipeline}
                onAddStage={handleAddStage}
                onTogglePassContext={handleTogglePassContext}
              />
            )}
            {selectedAgentIds.length > 0 && (
              <View style={styles.agentSettingsSection}>
                <Text style={[styles.agentSectionLabel, { color: theme.textTertiary }]}>
                  Agent Settings
                </Text>
                {selectedAgentIds.map((agentId) => {
                  const agent = getAgentById(agentId);
                  if (!agent) return null;
                  return (
                    <AgentSettings
                      key={`${agentId}-${agentSettingsVersion}`}
                      agent={agent}
                      onUpdate={(updates) => handleUpdateAgent(agentId, updates)}
                    />
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Past Streams */}
        {!stream.isStreaming && pastStreams.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>
              PAST STREAMS
            </Text>
            {pastStreams.map((ps) => (
              <TouchableOpacity
                key={ps.sessionId}
                style={[styles.pastStreamCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                activeOpacity={0.7}
                onPress={() => setSelectedStream(ps)}
              >
                <View style={styles.pastStreamRow}>
                  <View style={[styles.pastStreamIcon, { backgroundColor: theme.border }]}>
                    <Film size={16} color={theme.textSecondary} />
                  </View>
                  <View style={styles.pastStreamInfo}>
                    <Text style={[styles.pastStreamTitle, { color: theme.text }]} numberOfLines={1}>
                      {ps.title}
                    </Text>
                    <View style={styles.pastStreamMeta}>
                      <Clock size={11} color={theme.textTertiary} />
                      <Text style={[styles.pastStreamMetaText, { color: theme.textTertiary }]}>
                        {formatDuration(ps.duration)} · {ps.segmentCount} frames
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color={theme.textTertiary} />
                </View>
                {ps.aiTranscript.length > 0 && (
                  <Text style={[styles.pastStreamTranscript, { color: theme.textSecondary }]} numberOfLines={2}>
                    {ps.aiTranscript[ps.aiTranscript.length - 1]}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <StreamShareSheet visible={showShare} onClose={() => setShowShare(false)} />
      <AgentTogglePanel visible={showAgentPanel} onClose={() => setShowAgentPanel(false)} />
      <StreamDetailModal
        visible={!!selectedStream}
        stream={selectedStream}
        onClose={() => setSelectedStream(null)}
        onDeleted={(id) => setPastStreams((prev) => prev.filter((s) => s.sessionId !== id))}
      />

      {/* Fullscreen Preview */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        statusBarTranslucent
        onRequestClose={() => setIsFullscreen(false)}
      >
        <Pressable style={styles.fullscreenContainer} onPress={() => setIsFullscreen(false)}>
          <StatusBar hidden />
          <StreamPreview
            captureSource={stream.captureSource}
            isStreaming={stream.isStreaming}
            cameraPosition={stream.cameraPosition}
            onFlipCamera={handleFlipCamera}
            inferenceEnabled={inferenceEnabled}
            fullscreen
          />
          <View style={styles.fullscreenHint}>
            <Text style={styles.fullscreenHintText}>Tap to exit fullscreen</Text>
          </View>
          {stream.isStreaming && qaSessionActive && micAvailable && (
            <MicFAB
              visible
              qaStatus={qaStatus}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onInterrupt={interrupt}
              fullscreen
            />
          )}
          {stream.isStreaming && (
            <View style={styles.fullscreenStats}>
              <View style={styles.fullscreenStatRow}>
                <Text style={styles.fullscreenStatLabel}>{stream.formattedDuration}</Text>
                <Text style={styles.fullscreenStatDivider}>|</Text>
                <Text style={styles.fullscreenStatLabel}>{stream.segmentCount} segs</Text>
                <Text style={styles.fullscreenStatDivider}>|</Text>
                <Text style={styles.fullscreenStatLabel}>{stream.viewerCount} viewers</Text>
                <Text style={styles.fullscreenStatDivider}>|</Text>
                <Text style={styles.fullscreenStatLabel}>{stream.formattedBitrate}</Text>
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 80,
    gap: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  goLiveWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  goLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    gap: 10,
  },
  goLiveText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    gap: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stopBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: -8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  agentSettingsSection: {
    gap: 10,
  },
  agentSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pastStreamCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  pastStreamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pastStreamIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pastStreamInfo: {
    flex: 1,
    gap: 2,
  },
  pastStreamTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  pastStreamMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pastStreamMetaText: {
    fontSize: 11,
  },
  pastStreamTranscript: {
    fontSize: 12,
    lineHeight: 16,
    paddingLeft: 46,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullscreenHint: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  fullscreenHintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  fullscreenStats: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    alignItems: 'flex-start',
  },
  fullscreenStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  fullscreenStatLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  fullscreenStatDivider: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
});
