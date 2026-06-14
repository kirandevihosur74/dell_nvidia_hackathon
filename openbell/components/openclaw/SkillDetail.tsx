import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch } from "react-native";
import { useState, useCallback } from "react";
import { Star, Play, ChevronLeft, Info } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { OpenClawSkill, SkillParameter } from "@/types/skills";

interface SkillDetailProps {
  skill: OpenClawSkill;
  onInvoke: (params: Record<string, unknown>) => void;
  onToggleFavorite: () => void;
  onBack: () => void;
}

function ParameterInput({
  param,
  value,
  onChange,
}: {
  param: SkillParameter;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const { theme } = useThemeStore();

  if (param.type === "boolean") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: theme.text }}>
            {param.name}
            {param.required && <Text style={{ color: theme.error }}> *</Text>}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>{param.description}</Text>
        </View>
        <Switch value={!!value} onValueChange={onChange} />
      </View>
    );
  }

  if (param.type === "select" && param.options) {
    return (
      <View style={{ gap: 4, paddingVertical: 8 }}>
        <Text style={{ fontSize: 14, color: theme.text }}>
          {param.name}
          {param.required && <Text style={{ color: theme.error }}> *</Text>}
        </Text>
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>{param.description}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {param.options.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: value === opt ? theme.primary : theme.background,
                borderWidth: 1,
                borderColor: value === opt ? theme.primary : theme.border,
              }}
            >
              <Text style={{ fontSize: 13, color: value === opt ? "#FFFFFF" : theme.textSecondary }}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 4, paddingVertical: 8 }}>
      <Text style={{ fontSize: 14, color: theme.text }}>
        {param.name}
        {param.required && <Text style={{ color: theme.error }}> *</Text>}
      </Text>
      <Text style={{ fontSize: 11, color: theme.textTertiary }}>{param.description}</Text>
      <TextInput
        value={String(value ?? "")}
        onChangeText={(text) => onChange(param.type === "number" ? Number(text) || "" : text)}
        placeholder={param.default != null ? String(param.default) : `Enter ${param.name}...`}
        placeholderTextColor={theme.textTertiary}
        keyboardType={param.type === "number" ? "numeric" : "default"}
        style={{
          backgroundColor: theme.background,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 14,
          color: theme.text,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      />
    </View>
  );
}

export function SkillDetail({ skill, onInvoke, onToggleFavorite, onBack }: SkillDetailProps) {
  const { theme } = useThemeStore();
  const [params, setParams] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    for (const p of skill.parameters) {
      if (p.default != null) defaults[p.name] = p.default;
    }
    return defaults;
  });

  const updateParam = useCallback((name: string, value: unknown) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const canInvoke = skill.parameters
    .filter((p) => p.required)
    .every((p) => params[p.name] != null && params[p.name] !== "");

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <ChevronLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>{skill.name}</Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>{skill.category}</Text>
        </View>
        <TouchableOpacity onPress={onToggleFavorite} hitSlop={8}>
          <Star
            size={22}
            color={skill.isFavorite ? theme.warning : theme.textTertiary}
            fill={skill.isFavorite ? theme.warning : "none"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}>
        {/* Description */}
        <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Info size={14} color={theme.textTertiary} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase" }}>
              Description
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
            {skill.description}
          </Text>
        </View>

        {/* Examples */}
        {skill.examples.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>
              Examples
            </Text>
            {skill.examples.map((example, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onInvoke({ _raw: example })}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 10,
                }}
              >
                <Text style={{ fontSize: 13, color: theme.primary }}>{example}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Parameters */}
        {skill.parameters.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>
              Parameters
            </Text>
            <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 14 }}>
              {skill.parameters.map((param) => (
                <ParameterInput
                  key={param.name}
                  param={param}
                  value={params[param.name]}
                  onChange={(val) => updateParam(param.name, val)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Invoke Button */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
        <TouchableOpacity
          onPress={() => onInvoke(params)}
          disabled={!canInvoke}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: canInvoke ? theme.primary : theme.border,
            paddingVertical: 16,
            borderRadius: 12,
          }}
        >
          <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Run Skill</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
