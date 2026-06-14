import { View, Text } from "react-native";
import { Check, CheckCheck, Clock, AlertCircle, Send } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { OpenClawMessageStatus } from "@/types/openclaw";

interface Props {
  status: OpenClawMessageStatus;
  isUser: boolean;
}

const STATUS_CONFIG: Record<OpenClawMessageStatus, { icon: typeof Check; label: string }> = {
  queued: { icon: Clock, label: "Queued" },
  sending: { icon: Send, label: "Sending" },
  sent: { icon: Check, label: "Sent" },
  delivered: { icon: CheckCheck, label: "Delivered" },
  error: { icon: AlertCircle, label: "Failed" },
};

export function MessageStatusIndicator({ status, isUser }: Props) {
  const { theme } = useThemeStore();

  // Only show status on user messages
  if (!isUser) return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const color = status === "error"
    ? theme.error
    : status === "delivered"
    ? "rgba(255,255,255,0.8)"
    : "rgba(255,255,255,0.5)";

  return <Icon size={12} color={color} />;
}
