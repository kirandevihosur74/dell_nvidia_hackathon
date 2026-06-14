import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView } from "react-native";
import { Search, Star, Zap, Code, Mail, Terminal, Grid, Layers, RefreshCw, Database } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { OpenClawSkill, SkillCategory } from "@/types/skills";

interface SkillBrowserProps {
  skills: OpenClawSkill[];
  searchQuery: string;
  activeCategory: SkillCategory;
  loading: boolean;
  isConnected: boolean;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: SkillCategory) => void;
  onSelectSkill: (skill: OpenClawSkill) => void;
  onToggleFavorite: (skillId: string) => void;
  onRefresh: () => void;
}

const CATEGORY_FILTERS: { id: SkillCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "automation", label: "Automation" },
  { id: "development", label: "Dev" },
  { id: "communication", label: "Comms" },
  { id: "system", label: "System" },
  { id: "productivity", label: "Productivity" },
  { id: "custom", label: "Other" },
];

const CATEGORY_CARDS: { id: SkillCategory; label: string; description: string; icon: typeof Zap }[] = [
  { id: "automation", label: "Automation", description: "Trigger workflows", icon: Zap },
  { id: "development", label: "Dev", description: "Code & deploy", icon: Code },
  { id: "communication", label: "Comms", description: "Send messages", icon: Mail },
  { id: "system", label: "System", description: "Query & transform", icon: Database },
  { id: "productivity", label: "Productivity", description: "Notes & tasks", icon: Layers },
  { id: "custom", label: "Other", description: "Custom skills", icon: Grid },
];

export function SkillBrowser({
  skills,
  searchQuery,
  activeCategory,
  loading,
  isConnected,
  onSearchChange,
  onCategoryChange,
  onSelectSkill,
  onToggleFavorite,
  onRefresh,
}: SkillBrowserProps) {
  const { theme } = useThemeStore();

  const renderSkill = ({ item }: { item: OpenClawSkill }) => (
    <TouchableOpacity
      onPress={() => onSelectSkill(item)}
      activeOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        backgroundColor: theme.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        marginHorizontal: 16,
        marginBottom: 8,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: theme.primary + "15",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Zap size={20} color={theme.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>{item.name}</Text>
        <Text style={{ fontSize: 12, color: theme.textTertiary }} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => onToggleFavorite(item.id)}
        hitSlop={12}
        style={{ padding: 4 }}
      >
        <Star
          size={18}
          color={item.isFavorite ? theme.warning : theme.textTertiary}
          fill={item.isFavorite ? theme.warning : "none"}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={{ gap: 16 }}>
      {/* Info banner */}
      {!isConnected && (
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: theme.primary + "10",
            borderRadius: 14,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.primary + "25",
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.primary }}>
            Skills extend what you can do in chat.
          </Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>
            Connect a Gateway in the ClawMobile.app tab to load available skills.
          </Text>
        </View>
      )}

      {/* Available categories heading */}
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Available categories
        </Text>
      </View>

      {/* Category cards grid — 2 columns */}
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {Array.from({ length: Math.ceil(CATEGORY_CARDS.length / 2) }, (_, row) => (
          <View key={row} style={{ flexDirection: "row", gap: 10 }}>
            {CATEGORY_CARDS.slice(row * 2, row * 2 + 2).map((cat) => {
              const Icon = cat.icon;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => onCategoryChange(cat.id)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: theme.card,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: activeCategory === cat.id ? theme.primary : theme.border,
                    padding: 16,
                    gap: 10,
                  }}
                >
                  <Icon size={24} color={activeCategory === cat.id ? theme.primary : theme.textSecondary} />
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>{cat.label}</Text>
                    <Text style={{ fontSize: 12, color: theme.textTertiary }}>{cat.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Skills list heading (only when there are skills) */}
      {skills.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {activeCategory === "all" ? "All skills" : `${activeCategory} skills`}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <Search size={18} color={theme.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search skills..."
            placeholderTextColor={theme.textTertiary}
            style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: theme.text }}
          />
          {loading && <RefreshCw size={14} color={theme.primary} />}
        </View>
      </View>

      {/* Category filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 48, flexShrink: 0, marginBottom: 4 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 8, alignItems: "center" }}
      >
        {CATEGORY_FILTERS.map(({ id, label }) => {
          const active = activeCategory === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => onCategoryChange(id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 16,
                backgroundColor: active ? theme.text : theme.card,
                borderWidth: 1,
                borderColor: active ? theme.text : theme.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? "600" : "400",
                  color: active ? theme.background : theme.textSecondary,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <FlatList
        data={skills}
        renderItem={renderSkill}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListHeaderComponentStyle={{ paddingBottom: 16 }}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        ListEmptyComponent={
          skills.length === 0 && searchQuery ? (
            <View style={{ padding: 48, alignItems: "center" }}>
              <Search size={40} color={theme.textTertiary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textSecondary, marginTop: 12 }}>
                No matching skills
              </Text>
              <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", marginTop: 4 }}>
                Try a different search term
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
