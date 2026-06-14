import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useCallback, useMemo, useRef, useEffect } from "react";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { CheckCircle2, Edit3, Trash2, MessageSquare, Zap } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { AsanaTask } from "@/types/asana";

interface Props {
  task: AsanaTask | null;
  onClose: () => void;
  onComplete: (task: AsanaTask) => void;
  onEdit: (task: AsanaTask) => void;
  onDelete: (task: AsanaTask) => void;
  isAgentConnected?: boolean;
  onAskAgent?: (task: AsanaTask) => void;
  onDelegateToAgent?: (task: AsanaTask) => void;
}

export function TaskContextMenu({ task, onClose, onComplete, onEdit, onDelete, isAgentConnected, onAskAgent, onDelegateToAgent }: Props) {
  const { theme } = useThemeStore();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [isAgentConnected ? "45%" : "32%"], [isAgentConnected]);

  useEffect(() => {
    if (task) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [task]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    Alert.alert("Delete Task", `Delete "${task.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onDelete(task);
          onClose();
        },
      },
    ]);
  }, [task, onDelete, onClose]);

  if (!task) return null;

  const actions = [
    {
      icon: <CheckCircle2 size={20} color={theme.success} />,
      label: task.completed ? "Mark Open" : "Mark Complete",
      onPress: () => {
        onComplete(task);
        onClose();
      },
    },
    {
      icon: <Edit3 size={20} color={theme.primary} />,
      label: "Edit Task",
      onPress: () => {
        onEdit(task);
        onClose();
      },
    },
    {
      icon: <Trash2 size={20} color={theme.error} />,
      label: "Delete Task",
      onPress: handleDelete,
    },
    ...(isAgentConnected && onAskAgent
      ? [
          {
            icon: <MessageSquare size={20} color={theme.info} />,
            label: "Ask Agent About Task",
            onPress: () => onAskAgent(task),
          },
        ]
      : []),
    ...(isAgentConnected && onDelegateToAgent
      ? [
          {
            icon: <Zap size={20} color={theme.warning} />,
            label: "Delegate to Agent",
            onPress: () => {
              Alert.alert(
                "Delegate to Agent",
                `Send "${task.name}" to your ClawMobile.app agent?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delegate", onPress: () => onDelegateToAgent(task) },
                ]
              );
            },
          },
        ]
      : []),
  ];

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: theme.card }}
      handleIndicatorStyle={{ backgroundColor: theme.textTertiary }}
    >
      <BottomSheetView style={{ padding: 16, gap: 4 }}>
        <Text
          style={{ fontSize: 15, fontWeight: "600", color: theme.text, marginBottom: 12 }}
          numberOfLines={1}
        >
          {task.name}
        </Text>

        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            onPress={action.onPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 4,
              borderRadius: 8,
            }}
            activeOpacity={0.6}
          >
            {action.icon}
            <Text style={{ fontSize: 15, color: theme.text }}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </BottomSheetView>
    </BottomSheet>
  );
}
