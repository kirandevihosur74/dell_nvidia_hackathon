import { View, Text } from "react-native";

interface Props {
  size?: "small" | "normal";
}

const SLACK_BRAND = "#E01E5A";

export function SlackBadge({ size = "normal" }: Props) {
  const isSmall = size === "small";

  return (
    <View
      style={{
        backgroundColor: SLACK_BRAND + "14",
        paddingHorizontal: isSmall ? 4 : 6,
        paddingVertical: isSmall ? 1 : 2,
        borderRadius: isSmall ? 3 : 4,
      }}
    >
      <Text
        style={{
          fontSize: isSmall ? 8 : 10,
          fontWeight: "700",
          color: SLACK_BRAND,
          letterSpacing: 0.3,
        }}
      >
        SLACK
      </Text>
    </View>
  );
}
