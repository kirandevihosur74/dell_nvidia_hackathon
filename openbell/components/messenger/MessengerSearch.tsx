import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, ActivityIndicator } from "react-native";
import { useState, useCallback, useRef } from "react";
import { Search, X, Hash, ArrowRight } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { searchMessages, type SearchResult } from "@/services/messenger/messengerSearch";
import { formatMessageTime } from "@/utils/dateFormat";

interface Props {
  visible: boolean;
  onClose: () => void;
  onJumpToMessage: (channelId: string, messageId: string) => void;
}

export function MessengerSearch({ visible, onClose, onJumpToMessage }: Props) {
  const { theme } = useThemeStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const res = await searchMessages(text);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleClose = useCallback(() => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    onClose();
  }, [onClose]);

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      onPress={() => {
        onJumpToMessage(item.message.channelId, item.message.id);
        handleClose();
      }}
      activeOpacity={0.6}
      style={{
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      {/* Channel + time header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Hash size={12} color={theme.textTertiary} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary }}>
          {item.channelName}
        </Text>
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>
          {formatMessageTime(item.message.createdAt)}
        </Text>
      </View>

      {/* Author */}
      <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text, marginBottom: 2 }}>
        {item.message.displayName}
      </Text>

      {/* Snippet with highlighted match */}
      <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
        {item.matchSnippet}
      </Text>

      {/* Jump indicator */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
        <ArrowRight size={12} color={theme.primary} />
        <Text style={{ fontSize: 12, color: theme.primary, fontWeight: "500" }}>Jump to message</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Search header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <Search size={18} color={theme.textTertiary} />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search messages..."
            placeholderTextColor={theme.textTertiary}
            autoFocus
            style={{
              flex: 1,
              fontSize: 16,
              color: theme.text,
              paddingVertical: 8,
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")} hitSlop={8}>
              <X size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleClose} hitSlop={8}>
            <Text style={{ fontSize: 15, color: theme.primary, fontWeight: "500" }}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {isSearching ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : hasSearched && results.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Search size={48} color={theme.textTertiary} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: theme.textSecondary, marginTop: 16 }}>
              No Results
            </Text>
            <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", marginTop: 4 }}>
              No messages found matching "{query}"
            </Text>
          </View>
        ) : !hasSearched ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Search size={48} color={theme.textTertiary} />
            <Text style={{ fontSize: 14, color: theme.textTertiary, textAlign: "center", marginTop: 16 }}>
              Search across all channels and conversations
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderResult}
            keyExtractor={(item) => item.message.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}
