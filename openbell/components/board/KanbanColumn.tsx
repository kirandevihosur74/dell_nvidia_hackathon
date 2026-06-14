import { View, Text, FlatList } from "react-native";
import { useThemeStore } from "@/stores/themeStore";
import { KanbanCard } from "./KanbanCard";
import { getDueDateUrgency } from "@/utils/dateFormat";
import type { AsanaTask } from "@/types/asana";

interface Props {
  title: string;
  tasks: AsanaTask[];
  color: string;
  showOverdueCount?: boolean;
  onTaskPress?: (task: AsanaTask) => void;
  onTaskLongPress?: (task: AsanaTask) => void;
  renderCard?: (task: AsanaTask) => React.ReactNode;
}

export function KanbanColumn({ title, tasks, color, showOverdueCount, onTaskPress, onTaskLongPress, renderCard }: Props) {
  const { theme } = useThemeStore();

  const overdueCount = showOverdueCount
    ? tasks.filter((t) => getDueDateUrgency(t.due_on) === "overdue").length
    : 0;

  return (
    <View
      style={{
        width: 280,
        backgroundColor: theme.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        maxHeight: "100%",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>{title}</Text>
        <View style={{ backgroundColor: theme.background, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>{tasks.length}</Text>
        </View>
        {overdueCount > 0 && (
          <Text style={{ fontSize: 11, color: theme.error, fontWeight: "600", marginLeft: "auto" }}>
            {overdueCount} overdue
          </Text>
        )}
      </View>

      <FlatList
        data={tasks}
        renderItem={({ item }) =>
          renderCard ? (
            <>{renderCard(item)}</>
          ) : (
            <KanbanCard task={item} onPress={onTaskPress} onLongPress={onTaskLongPress} />
          )
        }
        keyExtractor={(item) => item.gid}
        contentContainerStyle={{ padding: 8, gap: 6 }}
        ListEmptyComponent={
          <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", padding: 16 }}>
            No tasks
          </Text>
        }
      />
    </View>
  );
}
