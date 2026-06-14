import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useState } from "react";
import { X, Plus, Server, Trash2, Wifi, WifiOff, ChevronRight, Pencil, QrCode, Keyboard } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { getAllProviders } from "@/services/gateway/providers/registry";
import { InviteCodeInput } from "@/components/gateway/InviteCodeInput";
import { DiscoveredGateways } from "@/components/gateway/DiscoveredGateways";
import { MyGateways } from "@/components/gateway/MyGateways";
import type { GatewayConfig, AuthMethod } from "@/types/gateway";
import type { ProviderType } from "@/services/gateway/providers/types";

interface GatewayPickerProps {
  visible: boolean;
  gateways: GatewayConfig[];
  activeGatewayId: string | null;
  onSelect: (gateway: GatewayConfig) => void;
  onAdd: (name: string, host: string, port: number, authMethod: AuthMethod, password?: string, providerType?: ProviderType) => void;
  onEdit: (id: string, updates: Partial<GatewayConfig>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onScanQR?: () => void;
  onDiscoveredConnect?: (config: GatewayConfig) => void;
}

export function GatewayPicker({
  visible,
  gateways,
  activeGatewayId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onClose,
  onScanQR,
  onDiscoveredConnect,
}: GatewayPickerProps) {
  const { theme } = useThemeStore();
  const [showForm, setShowForm] = useState<false | "add" | "edit" | "invite">(false);
  const [editingGatewayId, setEditingGatewayId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("18789");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [password, setPassword] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("openclaw");
  const availableProviders = getAllProviders();

  const resetForm = () => {
    setName("");
    setHost("");
    setPort("18789");
    setAuthMethod("password");
    setPassword("");
    setProviderType("openclaw");
    setShowForm(false);
    setEditingGatewayId(null);
  };

  const startEdit = (gateway: GatewayConfig) => {
    setEditingGatewayId(gateway.id);
    setName(gateway.name);
    setHost(gateway.host);
    setPort(String(gateway.port));
    setAuthMethod(gateway.authMethod);
    setPassword(gateway.password || "");
    setProviderType(gateway.providerType || "openclaw");
    setShowForm("edit");
  };

  const handleProviderChange = (type: ProviderType) => {
    setProviderType(type);
    const p = availableProviders.find((pv) => pv.type === type);
    if (p) {
      setPort(String(p.defaultPort));
    }
  };

  const handleAdd = () => {
    if (!name.trim() || !host.trim()) return;
    onAdd(name.trim(), host.trim(), parseInt(port, 10) || 18789, authMethod, password.trim() || undefined, providerType);
    resetForm();
  };

  const handleEdit = () => {
    if (!editingGatewayId || !name.trim() || !host.trim()) return;
    onEdit(editingGatewayId, {
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port, 10) || 18789,
      authMethod,
      password: password.trim() || undefined,
      providerType,
    });
    resetForm();
  };

  const handleDelete = (gateway: GatewayConfig) => {
    Alert.alert("Remove Gateway", `Remove "${gateway.name}"? This will unpair the device.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => onDelete(gateway.id) },
    ]);
  };

  const renderGateway = ({ item }: { item: GatewayConfig }) => {
    const isActive = item.id === activeGatewayId;
    return (
      <TouchableOpacity
        onPress={() => onSelect(item)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 16,
          backgroundColor: isActive ? theme.primary + "10" : theme.card,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.border,
          gap: 12,
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isActive ? theme.primary + "20" : theme.background, justifyContent: "center", alignItems: "center" }}>
          <Server size={20} color={isActive ? theme.primary : theme.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>{item.name}</Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>{item.host}:{item.port}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isActive ? (
            <Wifi size={14} color={theme.success} />
          ) : (
            <WifiOff size={14} color={theme.textTertiary} />
          )}
          <TouchableOpacity onPress={() => startEdit(item)} hitSlop={8}>
            <Pencil size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
            <Trash2 size={16} color={theme.error} />
          </TouchableOpacity>
          <ChevronRight size={16} color={theme.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const authOptions: { id: AuthMethod; label: string }[] = [
    { id: "pairing", label: "Pairing" },
    { id: "tailscale", label: "Tailscale" },
    { id: "password", label: "Password" },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Gateways</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {showForm === "invite" ? (
          /* Invite Code Entry */
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={{ padding: 16, gap: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>Enter Invite Code</Text>
              <InviteCodeInput onClose={() => { resetForm(); onClose(); }} />
              <TouchableOpacity
                onPress={resetForm}
                style={{ paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ fontSize: 15, color: theme.textTertiary }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : showForm ? (
          /* Add / Edit Gateway Form */
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>{showForm === "edit" ? "Edit Gateway" : "Add Gateway"}</Text>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>PROVIDER</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {availableProviders.map((p) => (
                  <TouchableOpacity
                    key={p.type}
                    onPress={() => handleProviderChange(p.type)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor: providerType === p.type ? theme.primary : theme.card,
                      borderWidth: 1,
                      borderColor: providerType === p.type ? theme.primary : theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: providerType === p.type ? "#FFFFFF" : theme.textSecondary }}>
                      {p.displayName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Home Mac"
                placeholderTextColor={theme.textTertiary}
                style={{ backgroundColor: theme.card, borderRadius: 10, padding: 12, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>HOST</Text>
              <TextInput
                value={host}
                onChangeText={setHost}
                placeholder="192.168.1.x or my-mac.tail12345.ts.net"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ backgroundColor: theme.card, borderRadius: 10, padding: 12, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border }}
              />
              <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 2 }}>
                Use your machine's LAN IP (not 127.0.0.1). Gateway must bind to LAN.
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>PORT</Text>
              <TextInput
                value={port}
                onChangeText={setPort}
                placeholder="18789"
                placeholderTextColor={theme.textTertiary}
                keyboardType="number-pad"
                style={{ backgroundColor: theme.card, borderRadius: 10, padding: 12, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>AUTH METHOD</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {authOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setAuthMethod(opt.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor: authMethod === opt.id ? theme.primary : theme.card,
                      borderWidth: 1,
                      borderColor: authMethod === opt.id ? theme.primary : theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: authMethod === opt.id ? "#FFFFFF" : theme.textSecondary }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {authMethod === "password" && (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>TOKEN / PASSWORD</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Paste gateway token here"
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={{ backgroundColor: theme.card, borderRadius: 10, padding: 12, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border }}
                />
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={resetForm}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={showForm === "edit" ? handleEdit : handleAdd}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: name.trim() && host.trim() ? theme.primary : theme.border }}
                disabled={!name.trim() || !host.trim()}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>{showForm === "edit" ? "Save" : "Add"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <>
            <FlatList
              data={gateways}
              renderItem={renderGateway}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListHeaderComponent={
                onDiscoveredConnect ? (
                  <View style={{ padding: 16, paddingBottom: 8, gap: 16 }}>
                    <DiscoveredGateways
                      onConnect={(config) => {
                        onDiscoveredConnect(config);
                        onClose();
                      }}
                    />
                    <MyGateways
                      onConnect={(config) => {
                        onDiscoveredConnect(config);
                        onClose();
                      }}
                    />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Server size={48} color={theme.textTertiary} />
                  <Text style={{ fontSize: 16, fontWeight: "600", color: theme.textSecondary, marginTop: 16 }}>
                    No Gateways
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", marginTop: 4 }}>
                    Add your ClawMobile.app Gateway to get started
                  </Text>
                </View>
              }
            />
            <View style={{ position: "absolute", bottom: 32, left: 16, right: 16, gap: 10 }}>
              {onScanQR && (
                <TouchableOpacity
                  onPress={() => { onClose(); onScanQR(); }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.primary,
                    paddingVertical: 14,
                    borderRadius: 12,
                    gap: 8,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                >
                  <QrCode size={20} color="#FFFFFF" />
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Scan QR Code</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowForm("invite")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.card,
                  paddingVertical: 14,
                  borderRadius: 12,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Keyboard size={20} color={theme.textSecondary} />
                <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>Enter Invite Code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowForm("add")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.card,
                  paddingVertical: 14,
                  borderRadius: 12,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Plus size={20} color={theme.textSecondary} />
                <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>Add Manually</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
