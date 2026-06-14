import { View, Text, TouchableOpacity, Linking } from "react-native";
import { Calendar, Clock, MapPin, Users } from "lucide-react-native";
import { format, parseISO } from "date-fns";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard, CalendarEventData } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

export function CalendarCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as CalendarEventData;

  const startDate = parseISO(data.startTime);
  const endDate = data.endTime ? parseISO(data.endTime) : null;

  return (
    <TouchableOpacity
      onPress={() => data.url && Linking.openURL(data.url)}
      activeOpacity={0.8}
    >
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
        }}
      >
        {/* Color accent bar */}
        <View style={{ height: 4, backgroundColor: theme.primary }} />

        <View style={{ padding: 12, gap: 8 }}>
          {/* Title */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Calendar size={16} color={theme.primary} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text, flex: 1 }} numberOfLines={2}>
              {data.title}
            </Text>
          </View>

          {/* Time */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Clock size={13} color={theme.textTertiary} />
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
              {data.isAllDay
                ? format(startDate, "EEE, MMM d")
                : `${format(startDate, "EEE, MMM d · h:mm a")}${endDate ? ` – ${format(endDate, "h:mm a")}` : ""}`}
            </Text>
          </View>

          {/* Location */}
          {data.location && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <MapPin size={13} color={theme.textTertiary} />
              <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
                {data.location}
              </Text>
            </View>
          )}

          {/* Attendees */}
          {data.attendees && data.attendees.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Users size={13} color={theme.textTertiary} />
              <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
                {data.attendees.length <= 3
                  ? data.attendees.join(", ")
                  : `${data.attendees.slice(0, 2).join(", ")} +${data.attendees.length - 2}`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
