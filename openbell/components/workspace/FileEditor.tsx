import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ArrowLeft, Save, Pencil, Eye } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface FileEditorProps {
  agentId: string;
}

export function FileEditor({ agentId }: FileEditorProps) {
  const { theme } = useThemeStore();
  const { activeFile, loading, saving, dirty, error, saveFile, setDirty, clearFile } =
    useWorkspaceStore();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleEdit = useCallback(() => {
    if (!activeFile) return;
    setEditContent(activeFile.content || "");
    setEditing(true);
    setDirty(false);
  }, [activeFile, setDirty]);

  const handlePreview = useCallback(() => {
    if (dirty) {
      Alert.alert("Unsaved Changes", "Discard changes?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setEditing(false);
            setDirty(false);
          },
        },
      ]);
    } else {
      setEditing(false);
    }
  }, [dirty, setDirty]);

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    await saveFile(agentId, activeFile.name, editContent);
    setEditing(false);
  }, [activeFile, agentId, editContent, saveFile]);

  const handleBack = useCallback(() => {
    if (dirty) {
      Alert.alert("Unsaved Changes", "Discard changes?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => clearFile(),
        },
      ]);
    } else {
      clearFile();
    }
  }, [dirty, clearFile]);

  const handleContentChange = useCallback(
    (text: string) => {
      setEditContent(text);
      setDirty(true);
    },
    [setDirty]
  );

  if (!activeFile) return null;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const bytes = activeFile.size || 0;
  const fileSize = bytes > 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${bytes} B`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          backgroundColor: theme.card,
          gap: 12,
        }}
      >
        <Pressable onPress={handleBack} hitSlop={16} style={{ padding: 4 }}>
          <ArrowLeft size={20} color={theme.text} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "600", color: theme.text }}
            numberOfLines={1}
          >
            {activeFile.name}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>
            {fileSize}
            {dirty ? " \u2022 Modified" : ""}
          </Text>
        </View>

        {editing ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={handlePreview} hitSlop={16} style={{ padding: 4 }}>
              <Eye size={20} color={theme.textSecondary} />
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving || !dirty} hitSlop={16} style={{ padding: 4 }}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Save size={20} color={dirty ? theme.primary : theme.textTertiary} />
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={handleEdit} hitSlop={16} style={{ padding: 4 }}>
            <Pencil size={20} color={theme.primary} />
          </Pressable>
        )}
      </View>

      {/* Error banner */}
      {error && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: theme.error + "15",
          }}
        >
          <Text style={{ fontSize: 13, color: theme.error }}>{error}</Text>
        </View>
      )}

      {/* Content */}
      {editing ? (
        <TextInput
          ref={inputRef}
          value={editContent}
          onChangeText={handleContentChange}
          multiline
          autoFocus
          textAlignVertical="top"
          style={{
            flex: 1,
            padding: 16,
            fontSize: 13,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            lineHeight: 20,
            color: theme.text,
            backgroundColor: theme.background,
          }}
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              lineHeight: 20,
              color: theme.text,
            }}
            selectable
          >
            {activeFile.content || ""}
          </Text>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
