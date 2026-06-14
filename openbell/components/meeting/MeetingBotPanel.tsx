import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Bot, ChevronDown, ChevronUp, LogOut } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useMeetingBot } from "@/hooks/useMeetingBot";
import { useMeetingBotStore } from "@/stores/meetingBotStore";
import { MeetingBotInput } from "./MeetingBotInput";
import { BotStatusIndicator } from "./BotStatusIndicator";
import { MeetingTranscriptPanel } from "./MeetingTranscriptPanel";
import { ActionItemsList } from "./ActionItemsList";
import { ActiveSpeakerIndicator } from "./ActiveSpeakerIndicator";
import { SpeakingTimeChart } from "./SpeakingTimeChart";
import { ParticipantEventIndicator } from "./ParticipantEventIndicator";
import { getActivePipeline } from "@/services/streamio/pipelineService";
import type { RoutingMode } from "@/types/recall";

export function MeetingBotPanel() {
  const { theme } = useThemeStore();
  const [expanded, setExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  const {
    botId,
    status,
    platform,
    routingMode,
    duration,
    error,
    transcriptLines,
    actionItems,
    speakingStats,
    activeSpeaker,
    participantEvents,
    isActive,
    deployBot,
    removeBot,
    confirmActionItem,
    dismissActionItem,
    pushActionItem,
  } = useMeetingBot();
  const killAllBots = useMeetingBotStore((s) => s.killAllBots);

  const isIdle = status === "idle" || status === "creating";
  const pendingCount = actionItems.filter((a) => a.status === "detected").length;

  const handleDeploy = useCallback(async (meetingUrl: string, mode: RoutingMode) => {
    try {
      // For inference/both routing, include the active pipeline from Stream tab
      // or a default meeting pipeline
      let pipeline: any = undefined;
      if (mode === "inference" || mode === "both") {
        const activePipeline = getActivePipeline();
        if (activePipeline) {
          pipeline = activePipeline;
        } else {
          // Default meeting pipeline: screen-analyst + meeting-summarizer
          pipeline = {
            id: "meeting-default",
            name: "Meeting Analysis",
            stages: [
              {
                stageIndex: 0,
                agents: ["screen-analyst", "meeting-summarizer"],
                passContextToNext: false,
                mergeStrategy: "concat",
              },
            ],
          };
        }
      }
      await deployBot({ meetingUrl, routingMode: mode, pipeline });
      setExpanded(true);
    } catch {
      // Error is captured in store
    }
  }, [deployBot]);

  const handleRemove = useCallback(() => {
    removeBot();
    setExpanded(false);
    setTranscriptExpanded(false);
  }, [removeBot]);

  const handleForceExit = useCallback(async () => {
    await killAllBots();
    setExpanded(false);
    setTranscriptExpanded(false);
  }, [killAllBots]);

  // Collapsed header when bot is idle
  if (isIdle && !expanded) {
    return (
      <TouchableOpacity
        style={[styles.collapsedHeader, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setExpanded(true)}
      >
        <View style={styles.collapsedRow}>
          <Bot size={14} color={theme.textSecondary} />
          <Text style={[styles.collapsedText, { color: theme.textSecondary }]}>
            Deploy a meeting bot
          </Text>
        </View>
        <ChevronDown size={14} color={theme.textTertiary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Collapse toggle when active */}
      {!isIdle && (
        <View style={[styles.collapsedHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => setExpanded(!expanded)}
            style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <View style={styles.collapsedRow}>
              <View style={[styles.liveDot, { backgroundColor: "#22C55E" }]} />
              <Text style={[styles.collapsedText, { color: theme.text }]}>
                Meeting Bot Active
              </Text>
              {pendingCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.primary + "20" }]}>
                  <Text style={[styles.badgeText, { color: theme.primary }]}>{pendingCount}</Text>
                </View>
              )}
            </View>
            {expanded ? (
              <ChevronUp size={14} color={theme.textTertiary} />
            ) : (
              <ChevronDown size={14} color={theme.textTertiary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleForceExit}
            hitSlop={8}
            style={{
              marginLeft: 10,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: "#EF444415",
            }}
          >
            <LogOut size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      {expanded && (
        <View style={styles.panelContent}>
          {isIdle ? (
            <>
              <MeetingBotInput onDeploy={handleDeploy} isDeploying={status === "creating"} />
              <TouchableOpacity onPress={() => setExpanded(false)}>
                <Text style={[styles.cancelText, { color: theme.textTertiary }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <BotStatusIndicator
                status={status}
                platform={platform}
                routingMode={routingMode}
                duration={duration}
                transcriptLineCount={transcriptLines.length}
                pendingActionItems={pendingCount}
                error={error}
                onRemove={handleRemove}
                participantEvents={participantEvents}
                activeSpeaker={activeSpeaker}
              />

              {(status === "recording" || transcriptLines.length > 0) && (
                <MeetingTranscriptPanel
                  lines={transcriptLines}
                  expanded={transcriptExpanded}
                  onToggle={() => setTranscriptExpanded(!transcriptExpanded)}
                  botId={botId}
                  isSessionEnded={status === "done"}
                  participantEvents={participantEvents}
                />
              )}

              {status === "recording" && Object.keys(speakingStats).length > 0 && (
                <SpeakingTimeChart stats={speakingStats} />
              )}

              <ActionItemsList
                items={actionItems}
                onConfirm={confirmActionItem}
                onDismiss={dismissActionItem}
                onPush={pushActionItem}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  collapsedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  collapsedText: {
    fontSize: 13,
    fontWeight: "500",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  panelContent: {
    gap: 8,
  },
  cancelText: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 4,
  },
});
