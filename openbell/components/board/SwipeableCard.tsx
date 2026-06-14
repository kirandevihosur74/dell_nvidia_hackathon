import { useRef } from "react";
import { View, Text, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Check, Trash2 } from "lucide-react-native";
import { KanbanCard } from "./KanbanCard";
import type { AsanaTask } from "@/types/asana";

interface Props {
  task: AsanaTask;
  onPress?: (task: AsanaTask) => void;
  onLongPress?: (task: AsanaTask) => void;
  onComplete?: (task: AsanaTask) => void;
  onDelete?: (task: AsanaTask) => void;
}

function RightAction() {
  return (
    <View
      style={{
        backgroundColor: "#EF4444",
        justifyContent: "center",
        alignItems: "center",
        width: 72,
        borderRadius: 10,
        marginLeft: 6,
      }}
    >
      <Trash2 size={18} color="#FFFFFF" />
      <Text style={{ fontSize: 10, color: "#FFFFFF", fontWeight: "600", marginTop: 2 }}>Delete</Text>
    </View>
  );
}

function LeftAction() {
  return (
    <View
      style={{
        backgroundColor: "#10B981",
        justifyContent: "center",
        alignItems: "center",
        width: 72,
        borderRadius: 10,
        marginRight: 6,
      }}
    >
      <Check size={18} color="#FFFFFF" />
      <Text style={{ fontSize: 10, color: "#FFFFFF", fontWeight: "600", marginTop: 2 }}>Done</Text>
    </View>
  );
}

export function SwipeableCard({ task, onPress, onLongPress, onComplete, onDelete }: Props) {
  const swipeRef = useRef<Swipeable>(null);

  const handleSwipeLeft = () => {
    swipeRef.current?.close();
    Alert.alert("Delete Task", `Delete "${task.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete?.(task),
      },
    ]);
  };

  const handleSwipeRight = () => {
    swipeRef.current?.close();
    onComplete?.(task);
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={task.completed ? undefined : LeftAction}
      renderRightActions={() => <RightAction />}
      onSwipeableOpen={(direction) => {
        if (direction === "left") handleSwipeRight();
        else handleSwipeLeft();
      }}
      overshootLeft={false}
      overshootRight={false}
    >
      <KanbanCard task={task} onPress={onPress} onLongPress={onLongPress} />
    </Swipeable>
  );
}
