// Stream Detail Modal — replay frames, view transcript, manage past streams
//
// Features:
//   1. Timeline scrubber + thumbnail strip
//   2. Playback speed (0.5x / 1x / 2x / 4x)
//   3. Share/save current frame
//   4. AI re-analysis on any frame
//   5. Frame-synced transcript (highlights active entry)
//   6. Auto-title from AI on first open

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Lazy-load native modules that aren't available in Expo Go
let Sharing: any = null;
let MediaLibrary: any = null;
try { Sharing = require('expo-sharing'); } catch {}
try { MediaLibrary = require('expo-media-library'); } catch {}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { StreamIOAPIConfig } from '@/constants/streamio/config';
import {
  PastStream,
  StreamFrame,
  fetchStreamFrames,
  deleteStream,
  renameStream,
  formatDuration,
} from '@/services/streamio/streamService';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Clock,
  Film,
  DollarSign,
  Pencil,
  Trash2,
  MessageSquare,
  Check,
  Share2,
  Download,
  Sparkles,
  Gauge,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_HEIGHT = (SCREEN_WIDTH - 32) * (9 / 16);
const THUMB_SIZE = 52;
const SPEED_OPTIONS = [0.5, 1, 2, 4];

interface StreamDetailModalProps {
  visible: boolean;
  stream: PastStream | null;
  onClose: () => void;
  onDeleted?: (sessionId: string) => void;
}

export const StreamDetailModal: React.FC<StreamDetailModalProps> = ({
  visible,
  stream,
  onClose,
  onDeleted,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const thumbListRef = useRef<FlatList>(null);
  const transcriptScrollRef = useRef<ScrollView>(null);

  const [frames, setFrames] = useState<StreamFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [title, setTitle] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [autoTitled, setAutoTitled] = useState(false);

  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // ─── Load frames + auto-title ─────────────────────────────────────
  useEffect(() => {
    if (visible && stream) {
      setTitle(stream.title);
      setEditTitle(stream.title);
      setFrameIndex(0);
      setPlaying(false);
      setAnalysisResult(null);
      setAutoTitled(false);
      loadFrames(stream.sessionId);
    } else {
      setFrames([]);
    }
    return () => stopPlayback();
  }, [visible, stream?.sessionId]);

  // Auto-title untitled streams once frames load
  useEffect(() => {
    if (
      frames.length > 0 &&
      stream &&
      title === 'Untitled Stream' &&
      !autoTitled
    ) {
      setAutoTitled(true);
      generateAutoTitle(stream.sessionId, frames[0].url);
    }
  }, [frames, title, autoTitled]);

  const loadFrames = async (sessionId: string) => {
    setLoadingFrames(true);
    try {
      const { frames: f } = await fetchStreamFrames(sessionId, 1, 100);
      setFrames(f);
    } catch {
      setFrames([]);
    } finally {
      setLoadingFrames(false);
    }
  };

  // ─── Playback ─────────────────────────────────────────────────────
  const startPlayback = useCallback(() => {
    if (frames.length === 0) return;
    setPlaying(true);
    playInterval.current = setInterval(() => {
      setFrameIndex((prev) => {
        if (prev >= frames.length - 1) {
          stopPlayback();
          return prev;
        }
        return prev + 1;
      });
    }, 500 / speedRef.current);
  }, [frames.length]);

  const stopPlayback = useCallback(() => {
    setPlaying(false);
    if (playInterval.current) {
      clearInterval(playInterval.current);
      playInterval.current = null;
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (playing) stopPlayback();
    else startPlayback();
  }, [playing, startPlayback, stopPlayback]);

  // Restart interval when speed changes during playback
  useEffect(() => {
    if (playing) {
      stopPlayback();
      startPlayback();
    }
  }, [speed]);

  const seekTo = (index: number) => {
    stopPlayback();
    setFrameIndex(Math.max(0, Math.min(index, frames.length - 1)));
  };

  // Scroll thumbnail strip to current frame
  useEffect(() => {
    if (frames.length > 0 && thumbListRef.current) {
      thumbListRef.current.scrollToIndex({
        index: frameIndex,
        animated: true,
        viewPosition: 0.5,
      });
    }
  }, [frameIndex]);

  // ─── Speed Cycle ──────────────────────────────────────────────────
  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    setSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  };

  // ─── Share / Save Frame ───────────────────────────────────────────
  const handleShareFrame = async () => {
    const frame = frames[frameIndex];
    if (!frame) return;

    try {
      const localUri = FileSystem.cacheDirectory + `frame_${frameIndex + 1}.jpg`;
      await FileSystem.downloadAsync(frame.url, localUri);

      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg' });
      } else {
        Alert.alert('Sharing not available', 'Requires a dev client build.');
      }
    } catch (err: any) {
      Alert.alert('Share failed', err.message);
    }
  };

  const handleSaveFrame = async () => {
    const frame = frames[frameIndex];
    if (!frame) return;

    if (!MediaLibrary) {
      Alert.alert('Save not available', 'Requires a dev client build.');
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to save photos.');
        return;
      }
      const localUri = FileSystem.cacheDirectory + `frame_${frameIndex + 1}.jpg`;
      await FileSystem.downloadAsync(frame.url, localUri);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Saved', 'Frame saved to your photo library.');
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    }
  };

  // ─── AI Re-Analysis ───────────────────────────────────────────────
  const handleAnalyzeFrame = async () => {
    const frame = frames[frameIndex];
    if (!frame || !stream || analyzing) return;

    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      // Download frame, convert to base64, submit to inference
      const localUri = FileSystem.cacheDirectory + `analyze_frame.jpg`;
      await FileSystem.downloadAsync(frame.url, localUri);
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const res = await fetch(`${StreamIOAPIConfig.baseURL}/api/v1/ai/analyze-screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: `data:image/jpeg;base64,${base64}`,
          prompt: 'Describe what you see in this frame in detail. Identify key objects, text, and activities.',
        }),
      });
      const json = await res.json();
      setAnalysisResult(json.analysis || json.result || json.message || 'No analysis returned.');
    } catch (err: any) {
      setAnalysisResult(`Analysis failed: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Auto-Title ───────────────────────────────────────────────────
  const generateAutoTitle = async (sessionId: string, firstFrameUrl: string) => {
    try {
      const localUri = FileSystem.cacheDirectory + 'autotitle_frame.jpg';
      await FileSystem.downloadAsync(firstFrameUrl, localUri);
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const res = await fetch(`${StreamIOAPIConfig.baseURL}/api/v1/ai/analyze-screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: `data:image/jpeg;base64,${base64}`,
          prompt: 'Generate a short 3-5 word title for this video stream based on what you see. Return ONLY the title, nothing else.',
        }),
      });
      const json = await res.json();
      const newTitle = (json.analysis || json.result || '').trim().replace(/^["']|["']$/g, '');
      if (newTitle && newTitle.length > 2 && newTitle.length < 60) {
        await renameStream(sessionId, newTitle).catch(() => {});
        setTitle(newTitle);
      }
    } catch {
      // Non-fatal — keep "Untitled Stream"
    }
  };

  // ─── Actions ──────────────────────────────────────────────────────
  const handleRename = async () => {
    if (!stream || !editTitle.trim()) return;
    try {
      await renameStream(stream.sessionId, editTitle.trim());
      setTitle(editTitle.trim());
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = () => {
    if (!stream) return;
    Alert.alert('Delete Stream', 'This will permanently delete this stream and all its frames.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStream(stream.sessionId);
            onDeleted?.(stream.sessionId);
            onClose();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  // ─── Frame-synced transcript index ────────────────────────────────
  // Map transcript entries evenly across frames
  const transcriptCount = stream?.aiTranscript?.length ?? 0;
  const activeTranscriptIndex =
    transcriptCount > 0 && frames.length > 0
      ? Math.min(
          Math.floor((frameIndex / Math.max(frames.length - 1, 1)) * transcriptCount),
          transcriptCount - 1,
        )
      : -1;

  if (!stream) return null;

  const currentFrame = frames[frameIndex];
  const startDate = new Date(stream.startedAt);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            Stream Detail
          </Text>
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Trash2 size={20} color={theme.error} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Frame Player ──────────────────────────────────── */}
          <View style={[styles.player, { backgroundColor: '#000' }]}>
            {loadingFrames ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : frames.length > 0 && currentFrame ? (
              <Image
                source={{ uri: currentFrame.url }}
                style={styles.frameImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.noFrames}>
                <Film size={32} color="rgba(255,255,255,0.4)" />
                <Text style={styles.noFramesText}>No frames available</Text>
              </View>
            )}

            {/* Frame counter + speed badge */}
            {frames.length > 0 && (
              <View style={styles.frameCounter}>
                <Text style={styles.frameCounterText}>
                  {frameIndex + 1} / {frames.length}
                </Text>
              </View>
            )}

            {/* Action buttons overlay */}
            {frames.length > 0 && (
              <View style={styles.playerActions}>
                <TouchableOpacity style={styles.playerActionBtn} onPress={handleShareFrame}>
                  <Share2 size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.playerActionBtn} onPress={handleSaveFrame}>
                  <Download size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.playerActionBtn} onPress={handleAnalyzeFrame}>
                  {analyzing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Sparkles size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ─── Timeline Scrubber ─────────────────────────────── */}
          {frames.length > 1 && (
            <View style={[styles.scrubberContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {/* Simple scrubber bar */}
              <View style={styles.slider}>
                <View style={[styles.sliderTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.sliderFill,
                      {
                        backgroundColor: '#3B82F6',
                        width: `${((frameIndex) / Math.max(frames.length - 1, 1)) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.sliderLabels}>
                  <Text style={{ color: theme.textTertiary, fontSize: 10 }}>1</Text>
                  <Text style={{ color: theme.textTertiary, fontSize: 10 }}>{frames.length}</Text>
                </View>
              </View>
              {/* Thumbnail Strip */}
              <FlatList
                ref={thumbListRef}
                data={frames}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.index)}
                getItemLayout={(_, index) => ({
                  length: THUMB_SIZE + 4,
                  offset: (THUMB_SIZE + 4) * index,
                  index,
                })}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => seekTo(index)}
                    style={[
                      styles.thumbItem,
                      index === frameIndex && { borderColor: '#3B82F6', borderWidth: 2 },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: item.url }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.thumbStrip}
                onScrollToIndexFailed={() => {}}
              />
            </View>
          )}

          {/* ─── Playback Controls ─────────────────────────────── */}
          {frames.length > 0 && (
            <View style={[styles.controls, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TouchableOpacity
                onPress={() => seekTo(frameIndex - 1)}
                disabled={frameIndex === 0}
                style={[styles.controlBtn, frameIndex === 0 && styles.controlBtnDisabled]}
              >
                <ChevronLeft size={22} color={frameIndex === 0 ? theme.textTertiary : theme.text} />
              </TouchableOpacity>

              <TouchableOpacity onPress={togglePlayback} style={styles.playBtn}>
                {playing ? (
                  <Pause size={20} color="#fff" fill="#fff" />
                ) : (
                  <Play size={20} color="#fff" fill="#fff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => seekTo(frameIndex + 1)}
                disabled={frameIndex >= frames.length - 1}
                style={[styles.controlBtn, frameIndex >= frames.length - 1 && styles.controlBtnDisabled]}
              >
                <ChevronRight
                  size={22}
                  color={frameIndex >= frames.length - 1 ? theme.textTertiary : theme.text}
                />
              </TouchableOpacity>

              {/* Speed toggle */}
              <TouchableOpacity onPress={cycleSpeed} style={styles.speedBtn}>
                <Gauge size={13} color={theme.textSecondary} />
                <Text style={[styles.speedText, { color: theme.textSecondary }]}>
                  {speed}x
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── AI Analysis Result ────────────────────────────── */}
          {analysisResult && (
            <View style={[styles.analysisCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
              <View style={styles.analysisHeader}>
                <Sparkles size={14} color="#6366F1" />
                <Text style={styles.analysisLabel}>AI ANALYSIS — Frame {frameIndex + 1}</Text>
              </View>
              <Text style={styles.analysisText}>{analysisResult}</Text>
            </View>
          )}

          {/* ─── Title (editable) ──────────────────────────────── */}
          <View style={[styles.titleRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {isEditing ? (
              <View style={styles.editRow}>
                <TextInput
                  style={[styles.title, { color: theme.text, borderColor: theme.border, borderBottomWidth: 1, paddingBottom: 4 }]}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleRename}
                />
                <TouchableOpacity onPress={handleRename} style={styles.editAction}>
                  <Check size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.editAction}>
                  <X size={18} color={theme.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : (
              <Pressable style={styles.editRow} onPress={() => { setEditTitle(title); setIsEditing(true); }}>
                <Text style={[styles.titleText, { color: theme.text }]} numberOfLines={1}>
                  {title}
                </Text>
                <Pencil size={14} color={theme.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* ─── Metadata Grid ─────────────────────────────────── */}
          <View style={[styles.metaGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MetaStat icon={<Clock size={14} color={theme.primary} />} label="Duration" value={formatDuration(stream.duration)} colors={theme} />
            <MetaStat icon={<Film size={14} color={theme.primary} />} label="Frames" value={String(stream.segmentCount)} colors={theme} />
            <MetaStat icon={<DollarSign size={14} color={theme.primary} />} label="AI Cost" value={`$${stream.estimatedCost.toFixed(3)}`} colors={theme} />
            <MetaStat icon={<Clock size={14} color={theme.textTertiary} />} label="Date" value={startDate.toLocaleDateString()} colors={theme} />
          </View>

          {/* ─── Frame-Synced Transcript ────────────────────────── */}
          {stream.aiTranscript.length > 0 && (
            <View style={[styles.transcriptCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.transcriptHeader}>
                <MessageSquare size={14} color={theme.primary} />
                <Text style={[styles.transcriptLabel, { color: theme.textTertiary }]}>
                  AI TRANSCRIPT
                </Text>
                {activeTranscriptIndex >= 0 && (
                  <Text style={[styles.transcriptFrameHint, { color: theme.primary }]}>
                    Frame {frameIndex + 1}
                  </Text>
                )}
              </View>
              {stream.aiTranscript.map((line, i) => {
                const isActive = i === activeTranscriptIndex;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      // Tap transcript entry to seek to corresponding frame
                      if (frames.length > 0 && transcriptCount > 0) {
                        const targetFrame = Math.round((i / Math.max(transcriptCount - 1, 1)) * (frames.length - 1));
                        seekTo(targetFrame);
                      }
                    }}
                  >
                    <View
                      style={[
                        styles.transcriptEntry,
                        isActive && { backgroundColor: theme.primary + '12', borderLeftColor: theme.primary },
                        isActive && styles.transcriptEntryActive,
                      ]}
                    >
                      <Text style={[styles.transcriptIndex, { color: isActive ? theme.primary : theme.textTertiary }]}>
                        {i + 1}
                      </Text>
                      <Text
                        style={[
                          styles.transcriptLine,
                          { color: isActive ? theme.text : theme.textSecondary },
                          isActive && styles.transcriptLineActive,
                        ]}
                      >
                        {line}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

// ─── Helper Components ─────────────────────────────────────────────

function MetaStat({ icon, label, value, colors }: { icon: React.ReactNode; label: string; value: string; colors: any }) {
  return (
    <View style={styles.metaItem}>
      {icon}
      <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
    gap: 12,
  },

  // ─── Player ───────────────────────────────────────────────────
  player: {
    width: '100%',
    height: PLAYER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameImage: { width: '100%', height: '100%' },
  noFrames: { alignItems: 'center', gap: 8 },
  noFramesText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  frameCounter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  frameCounterText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  playerActions: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  playerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Scrubber + Thumbnails ────────────────────────────────────
  scrubberContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  slider: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 2,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  thumbStrip: {
    paddingHorizontal: 8,
    gap: 4,
  },
  thumbItem: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * (9 / 16),
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumbImage: { width: '100%', height: '100%' },

  // ─── Controls ─────────────────────────────────────────────────
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    gap: 20,
  },
  controlBtn: { padding: 8 },
  controlBtnDisabled: { opacity: 0.4 },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  speedText: { fontSize: 12, fontWeight: '700' },

  // ─── Analysis Result ──────────────────────────────────────────
  analysisCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  analysisLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#6366F1',
  },
  analysisText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#3730A3',
  },

  // ─── Title ────────────────────────────────────────────────────
  titleRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontWeight: '600', flex: 1 },
  titleText: { fontSize: 17, fontWeight: '600', flex: 1 },
  editAction: { padding: 4 },

  // ─── Metadata ─────────────────────────────────────────────────
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  metaItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  metaLabel: { fontSize: 11, fontWeight: '500' },
  metaValue: { fontSize: 13, fontWeight: '600' },

  // ─── Transcript ───────────────────────────────────────────────
  transcriptCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  transcriptFrameHint: {
    fontSize: 10,
    fontWeight: '600',
  },
  transcriptEntry: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  transcriptEntryActive: {
    borderLeftWidth: 2,
  },
  transcriptIndex: {
    fontSize: 10,
    fontWeight: '700',
    width: 18,
    textAlign: 'right',
    paddingTop: 2,
  },
  transcriptLine: { fontSize: 13, lineHeight: 19, flex: 1 },
  transcriptLineActive: { fontWeight: '500' },
});
