import { View, Text } from "react-native";
import { Link } from "expo-router";

export default function NotFound() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Page Not Found</Text>
      <Link href="/" style={{ color: "#3B82F6" }}>
        Go Home
      </Link>
    </View>
  );
}
