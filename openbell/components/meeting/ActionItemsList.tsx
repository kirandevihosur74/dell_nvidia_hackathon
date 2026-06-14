import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Check, X, ExternalLink } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { ShareToChatButton } from "./ShareToChatButton";
import type { MeetingActionItem } from "@/types/recall";

interface Props {
  items: MeetingActionItem[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onPush: (id: string) => void;
}

export function ActionItemsList({ items, onConfirm, onDismiss, onPush }: Props) {
  const { theme } = useThemeStore();

  const pending = items.filter((i) => i.status === "detected");
  const confirmed = items.filter((i) => i.status === "confirmed");
  const pushed = items.filter((i) => i.status === "pushed");
  const dismissed = items.filter((i) => i.status === "dismissed");

  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Action Items ({pending.length} pending)
      </Text>

      {pending.map((item) => (
        <View key={item.id} style={[styles.item, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.itemContent}>
            <Text style={[styles.description, { color: theme.text }]}>{item.description}</Text>
            {item.owner && (
              <Text style={[styles.meta, { color: theme.textSecondary }]}>Owner: {item.owner}</Text>
            )}
            {item.deadline && (
              <Text style={[styles.meta, { color: theme.textSecondary }]}>Deadline: {item.deadline}</Text>
            )}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => onConfirm(item.id)}
              style={[styles.actionBtn, { backgroundColor: "#22C55E20" }]}
            >
              <Check size={14} color="#22C55E" />
              <Text style={[styles.actionLabel, { color: "#22C55E" }]}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDismiss(item.id)}
              style={[styles.actionBtn, { backgroundColor: "#EF444420" }]}
            >
              <X size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {confirmed.map((item) => (
        <View key={item.id} style={[styles.item, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.itemContent}>
            <Text style={[styles.description, { color: theme.text }]}>{item.description}</Text>
          </View>
          <View style={styles.actions}>
            <ShareToChatButton
              message={`[Action Item] ${item.owner ? `${item.owner}: ` : ""}${item.description}${item.deadline ? ` (by ${item.deadline})` : ""}`}
            />
            <TouchableOpacity
              onPress={() => onPush(item.id)}
              style={[styles.actionBtn, { backgroundColor: theme.primary + "20" }]}
            >
              <ExternalLink size={14} color={theme.primary} />
              <Text style={[styles.actionLabel, { color: theme.primary }]}>Push</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {pushed.length > 0 && (
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>
          Pushed ({pushed.length})
        </Text>
      )}
      {pushed.map((item) => (
        <View key={item.id} style={[styles.item, { backgroundColor: theme.card, borderColor: theme.border, opacity: 0.6 }]}>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{item.description}</Text>
          <Text style={[styles.meta, { color: "#22C55E" }]}>Pushed to Kanban + Board</Text>
        </View>
      ))}

      {dismissed.length > 0 && (
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>
          Dismissed ({dismissed.length})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
  },
  item: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  itemContent: {
    gap: 2,
  },
  description: {
    fontSize: 13,
    fontWeight: "500",
  },
  meta: {
    fontSize: 11,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
