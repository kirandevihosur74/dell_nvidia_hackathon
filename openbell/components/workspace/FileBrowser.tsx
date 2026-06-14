import { useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { FileText, AlertCircle } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { GatewayFileEntry } from "@/types/gateway";

interface FileBrowserProps {
  agentId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function FileBrowser({ agentId }: FileBrowserProps) {
  const { theme } = useThemeStore();
  const { files, loading, error, listFiles, openFile, clearError } = useWorkspaceStore();

  useEffect(() => {
    if (agentId) listFiles(agentId);
  }, [agentId, listFiles]);

  const handleRefresh = useCallback(() => {
    if (agentId) listFiles(agentId);
  }, [agentId, listFiles]);

  const handlePress = useCallback(
    (file: GatewayFileEntry) => {
      if (file.missing) return;
      openFile(agentId, file.name);
    },
    [agentId, openFile]
  );

  const renderItem = useCallback(
    ({ item }: { item: GatewayFileEntry }) => (
      <TouchableOpacity
        onPress={() => handlePress(item)}
        disabled={item.missing}
        activeOpacity={0.6}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          opacity: item.missing ? 0.4 : 1,
          gap: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: theme.primary + "12",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <FileText size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>
            {formatSize(item.size)}
            {item.updatedAtMs ? ` \u2022 ${formatDate(item.updatedAtMs)}` : ""}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [theme, handlePress]
  );

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <AlertCircle size={32} color={theme.error} />
        <Text style={{ fontSize: 14, color: theme.error, marginTop: 12, textAlign: "center" }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={() => { clearError(); handleRefresh(); }}
          style={{
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: theme.primary,
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const availableFiles = Array.isArray(files) ? files.filter((f) => !f.missing) : [];

  return (
    <FlatList
      data={availableFiles}
      keyExtractor={(item) => item.name}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={theme.primary} />
      }
      ListEmptyComponent={
        loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 }}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={{ fontSize: 13, color: theme.textTertiary, marginTop: 12 }}>
              Loading workspace files...
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 }}>
            <FileText size={40} color={theme.textTertiary} />
            <Text style={{ fontSize: 14, color: theme.textTertiary, marginTop: 12 }}>
              No workspace files found
            </Text>
            <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4 }}>
              Connect to an agent to browse its workspace
            </Text>
          </View>
        )
      }
    />
  );
}
