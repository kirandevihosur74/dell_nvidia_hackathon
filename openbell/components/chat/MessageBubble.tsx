import { View, Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useThemeStore } from "@/stores/themeStore";
import { formatMessageTime } from "@/utils/dateFormat";
import { TaskCard } from "./TaskCard";
import { TaskListCard } from "./TaskListCard";
import { VoiceOutputButton } from "./VoiceOutputButton";
import type { Message, ToolCall } from "@/types/chat";
import type { AsanaTask } from "@/types/asana";

interface Props {
  message: Message;
}

function extractTasks(toolCalls?: ToolCall[]): AsanaTask[] {
  if (!toolCalls) return [];

  const tasks: AsanaTask[] = [];
  for (const tc of toolCalls) {
    const result = tc.result;
    if (!result) continue;

    // Single task result (create_task, complete_task, update_task)
    if (result.gid && result.name) {
      tasks.push(result as unknown as AsanaTask);
    }
    // List of tasks (list_tasks, search_tasks)
    if (Array.isArray(result)) {
      for (const item of result) {
        if (item && typeof item === "object" && "gid" in item) {
          tasks.push(item as unknown as AsanaTask);
        }
      }
    }
    // Nested data array
    if (result.data && Array.isArray(result.data)) {
      for (const item of result.data) {
        if (item && typeof item === "object" && "gid" in item) {
          tasks.push(item as unknown as AsanaTask);
        }
      }
    }
  }
  return tasks;
}

export function MessageBubble({ message }: Props) {
  const { theme } = useThemeStore();
  const isUser = message.role === "user";
  const tasks = extractTasks(message.toolCalls);

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()}>
      <View
        style={{
          alignSelf: isUser ? "flex-end" : "flex-start",
          maxWidth: isUser ? "80%" : "90%",
        }}
      >
        {/* Text bubble */}
        <View
          style={{
            backgroundColor: isUser ? theme.userBubble : theme.aiBubble,
            borderWidth: isUser ? 0 : 1,
            borderColor: theme.aiBubbleBorder,
            borderRadius: 16,
            borderBottomRightRadius: isUser ? 4 : 16,
            borderBottomLeftRadius: isUser ? 16 : 4,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: isUser ? theme.userBubbleText : theme.aiBubbleText,
            }}
          >
            {message.content}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
            {!isUser && <VoiceOutputButton text={message.content} />}
            <Text
              style={{
                fontSize: 11,
                color: isUser ? "rgba(255,255,255,0.6)" : theme.textTertiary,
              }}
            >
              {formatMessageTime(message.timestamp)}
            </Text>
          </View>
        </View>

        {/* Inline task cards */}
        {!isUser && tasks.length === 1 && <TaskCard task={tasks[0]} />}
        {!isUser && tasks.length > 1 && <TaskListCard tasks={tasks} />}
      </View>
    </Animated.View>
  );
}
