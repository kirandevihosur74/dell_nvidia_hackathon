import { View, Text } from "react-native";
import { useThemeStore } from "@/stores/themeStore";

interface Props {
  content: string;
}

export function StreamingMessage({ content }: Props) {
  const { theme } = useThemeStore();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        maxWidth: "80%",
        backgroundColor: theme.aiBubble,
        borderWidth: 1,
        borderColor: theme.aiBubbleBorder,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontSize: 15, lineHeight: 22, color: theme.aiBubbleText }}>
        {content}
        <Text style={{ color: theme.primary }}>|</Text>
      </Text>
    </View>
  );
}
