import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Bell, Settings } from "lucide-react-native";
import { Colors } from "@/components/onboarding/theme";

interface OnboardingHomeHeaderProps {
  title?: string;
  subtitle?: string;
}

/**
 * Branded OpenBell onboarding header. Simplified from the source app's
 * HeaderWithTicker-based header to stay self-contained (no user/auth/ticker deps).
 */
const OnboardingHomeHeader: React.FC<OnboardingHomeHeaderProps> = ({
  title = "Your OpenBell Journey",
  subtitle = "Welcome!",
}) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* decorative pattern */}
        <View style={styles.pattern} pointerEvents="none">
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.circle3} />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.iconButton}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
              <Bell size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Settings size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  gradient: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 22,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  pattern: { ...StyleSheet.absoluteFillObject },
  circle1: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.1)",
    top: -50,
    right: -30,
  },
  circle2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.08)",
    bottom: -30,
    left: 30,
  },
  circle3: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    top: 30,
    left: 160,
  },
  row: { flexDirection: "row", alignItems: "center" },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600", marginBottom: 2 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#FF5C5C",
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "bold" },
});

export default OnboardingHomeHeader;
