import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Modal, ScrollView } from "react-native";
import { ChevronDown, ChevronUp, Search, Download, Activity } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { e2eService } from "@/services/encryption";
import * as recallService from "@/services/recall/recallService";
import { ParticipantEventIndicator } from "./ParticipantEventIndicator";
import type { TranscriptLine, ParticipantEvent } from "@/types/recall";

type DisplayItem =
  | { kind: "transcript"; line: TranscriptLine; index: number }
  | { kind: "event"; event: ParticipantEvent; index: number };

interface Props {
  lines: TranscriptLine[];
  expanded: boolean;
  onToggle: () => void;
  botId?: string | null;
  isSessionEnded?: boolean;
  participantEvents?: ParticipantEvent[];
}

const SPEAKER_COLORS = [
  "#3B82F6", "#22C55E", "#F97316", "#A855F7",
  "#EC4899", "#14B8A6", "#EAB308", "#6366F1",
];

function getSpeakerColor(speaker: string): string {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

export function MeetingTranscriptPanel({ lines, expanded, onToggle, botId, isSessionEnded, participantEvents = [] }: Props) {
  const { theme } = useThemeStore();
  const listRef = useRef<FlatList>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const nonSpeechEvents = useMemo(
    () => participantEvents.filter((e) => e.type !== "speech_on" && e.type !== "speech_off"),
    [participantEvents],
  );

  // Post-meeting: download and decrypt full transcript
  const [fullTranscript, setFullTranscript] = useState<TranscriptLine[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && lines.length > 0 && !searchQuery) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [lines.length, expanded, searchQuery]);

  const displayLines = useMemo(() => {
    const source = fullTranscript || lines;
    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase();
    return source.filter(
      (l) => l.text.toLowerCase().includes(q) || l.speaker.toLowerCase().includes(q),
    );
  }, [lines, fullTranscript, searchQuery]);

  // Option 1: Interleave participant events with transcript lines by timestamp
  const interleaved = useMemo((): DisplayItem[] => {
    const nonSpeechEvents = participantEvents.filter(
      (e) => e.type !== "speech_on" && e.type !== "speech_off",
    );
    if (nonSpeechEvents.length === 0) {
      return displayLines.map((line, i) => ({ kind: "transcript" as const, line, index: i }));
    }

    const items: DisplayItem[] = [];
    let eventIdx = 0;

    for (let i = 0; i < displayLines.length; i++) {
      const lineTime = new Date(displayLines[i].timestamp).getTime();
      // Insert any events that happened before this transcript line
      while (eventIdx < nonSpeechEvents.length) {
        const evtTime = new Date(nonSpeechEvents[eventIdx].timestamp.absolute).getTime();
        if (evtTime <= lineTime) {
          items.push({ kind: "event", event: nonSpeechEvents[eventIdx], index: 10000 + eventIdx });
          eventIdx++;
        } else {
          break;
        }
      }
      items.push({ kind: "transcript", line: displayLines[i], index: i });
    }
    // Append remaining events
    while (eventIdx < nonSpeechEvents.length) {
      items.push({ kind: "event", event: nonSpeechEvents[eventIdx], index: 10000 + eventIdx });
      eventIdx++;
    }
    return items;
  }, [displayLines, participantEvents]);

  const handleDownloadTranscript = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const result = await recallService.downloadEncryptedTranscript(botId);
      const activeGatewayId = useGatewayStore.getState().activeGatewayId;

      let decryptedJson = result.encryptedBlob;
      if (activeGatewayId && result.encryptionKeyId) {
        decryptedJson = await e2eService.decryptFromStorage(activeGatewayId, result.encryptedBlob);
      }

      const parsed: TranscriptLine[] = JSON.parse(decryptedJson);
      setFullTranscript(parsed);
    } catch (err: any) {
      console.warn("[Transcript] Download/decrypt failed:", err.message);
    }
    setLoading(false);
  }, [botId]);

  const ChevronIcon = expanded ? ChevronUp : ChevronDown;
  const lineCount = fullTranscript ? fullTranscript.length : lines.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity onPress={onToggle} style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          Transcript ({lineCount} lines)
          {searchQuery ? ` — ${displayLines.length} matches` : ""}
        </Text>
        <View style={styles.headerActions}>
          {/* Option 3: Events badge */}
          {expanded && nonSpeechEvents.length > 0 && (
            <TouchableOpacity onPress={() => setShowEventsModal(true)} hitSlop={8} style={styles.eventsBadge}>
              <Activity size={12} color="#8B5CF6" />
              <Text style={styles.eventsBadgeText}>{nonSpeechEvents.length}</Text>
            </TouchableOpacity>
          )}
          {expanded && (
            <TouchableOpacity onPress={() => setShowSearch(!showSearch)} hitSlop={8}>
              <Search size={14} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          {expanded && isSessionEnded && !fullTranscript && botId && (
            <TouchableOpacity onPress={handleDownloadTranscript} hitSlop={8}>
              {loading ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <Download size={14} color={theme.textSecondary} />
              )}
            </TouchableOpacity>
          )}
          <ChevronIcon size={16} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      {expanded && showSearch && (
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
          placeholder="Search transcript..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      )}

      {expanded && (
        <FlatList
          ref={listRef}
          data={interleaved}
          keyExtractor={(item) => `${item.kind}-${item.index}`}
          style={styles.list}
          renderItem={({ item }) => {
            if (item.kind === "event") {
              return (
                <ParticipantEventIndicator
                  type={item.event.type}
                  participantName={item.event.participant.name}
                  timestamp={item.event.timestamp.absolute}
                />
              );
            }
            return (
              <View style={styles.line}>
                <Text style={[styles.speaker, { color: getSpeakerColor(item.line.speaker) }]}>
                  {item.line.speaker}
                </Text>
                <Text style={[styles.text, { color: theme.text }]}>{item.line.text}</Text>
              </View>
            );
          }}
          onContentSizeChange={() => {
            if (!searchQuery) listRef.current?.scrollToEnd({ animated: false });
          }}
        />
      )}
      {/* Option 3: Events bottom sheet modal */}
      <Modal visible={showEventsModal} transparent animationType="slide" onRequestClose={() => setShowEventsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEventsModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Participant Events ({nonSpeechEvents.length})
            </Text>
            <ScrollView style={styles.modalList}>
              {nonSpeechEvents.map((evt, i) => (
                <ParticipantEventIndicator
                  key={`modal-${i}`}
                  type={evt.type}
                  participantName={evt.participant.name}
                  timestamp={evt.timestamp.absolute}
                />
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowEventsModal(false)} style={styles.modalClose}>
              <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 14 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  searchInput: {
    marginHorizontal: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
  },
  list: {
    maxHeight: 300,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  line: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  speaker: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 60,
  },
  text: {
    fontSize: 12,
    flex: 1,
  },
  eventsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#8B5CF620",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  eventsBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "60%",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalList: {
    marginBottom: 12,
  },
  modalClose: {
    alignItems: "center",
    paddingVertical: 10,
  },
});
