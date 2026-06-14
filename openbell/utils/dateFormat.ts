import { formatDistanceToNow, format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";

export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatMessageTime(date: string): string {
  const d = new Date(date);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

export function formatDueDate(date: string | undefined): string {
  if (!date) return "No due date";
  return format(new Date(date), "MMM d, yyyy");
}

export type DueDateUrgency = "overdue" | "soon" | "upcoming" | "none";

export function getDueDateUrgency(date: string | undefined): DueDateUrgency {
  if (!date) return "none";
  const days = differenceInCalendarDays(new Date(date), new Date());
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "upcoming";
}

export function getDueDateColor(
  urgency: DueDateUrgency,
  theme: { error: string; warning: string; textTertiary: string; success: string }
): string {
  switch (urgency) {
    case "overdue":
      return theme.error;
    case "soon":
      return theme.warning;
    case "upcoming":
      return theme.success;
    default:
      return theme.textTertiary;
  }
}
