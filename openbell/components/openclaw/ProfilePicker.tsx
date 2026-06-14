import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { User, Plus, Check, Trash2, X } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import * as profileManager from "@/services/gateway/profileManager";
import { sessionManager } from "@/services/gateway/sessionManager";
import type { GatewayProfile } from "@/types/gateway";

export function ProfilePicker() {
  const { theme } = useThemeStore();
  const {
    activeGatewayId,
    activeProfileId,
    profiles,
    setProfiles,
    setActiveProfile,
    addProfile,
    removeProfile,
    updateProfile,
  } = useGatewayStore();

  const [showSheet, setShowSheet] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingProfile, setEditingProfile] = useState<GatewayProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Load profiles when gateway changes
  useEffect(() => {
    if (!activeGatewayId) return;
    profileManager.getProfiles(activeGatewayId).then((p) => {
      setProfiles(p);
      profileManager.getActiveProfileId(activeGatewayId).then((id) => {
        setActiveProfile(id);
        sessionManager.setActiveProfile(id);
      });
    });
  }, [activeGatewayId]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const handleSwitch = async (profile: GatewayProfile) => {
    if (!activeGatewayId || profile.id === activeProfileId) {
      setShowSheet(false);
      return;
    }
    await profileManager.setActiveProfile(activeGatewayId, profile.id);
    setActiveProfile(profile.id);
    sessionManager.setActiveProfile(profile.id);
    setShowSheet(false);
  };

  const handleCreate = async () => {
    if (!activeGatewayId || !newName.trim()) return;
    const profile = await profileManager.createProfile(activeGatewayId, newName.trim());
    addProfile(profile);
    setNewName("");
    setShowCreate(false);
  };

  const AVATAR_COLORS = [
    "#3B82F6", "#22C55E", "#F97316", "#A855F7",
    "#EC4899", "#14B8A6", "#EAB308", "#6366F1",
    "#EF4444", "#06B6D4",
  ];

  const handleEdit = (profile: GatewayProfile) => {
    setEditingProfile(profile);
    setEditName(profile.displayName);
    setEditColor(profile.avatarColor || "#3B82F6");
  };

  const handleSaveEdit = async () => {
    if (!activeGatewayId || !editingProfile || !editName.trim()) return;
    await profileManager.updateProfile(activeGatewayId, editingProfile.id, {
      displayName: editName.trim(),
      avatarColor: editColor,
    });
    updateProfile(editingProfile.id, { displayName: editName.trim(), avatarColor: editColor });
    setEditingProfile(null);
  };

  const handleDelete = (profile: GatewayProfile) => {
    if (profile.isDefault) return;
    Alert.alert(
      "Delete Profile",
      `Delete "${profile.displayName}"? Their sessions and messages will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!activeGatewayId) return;
            const deleted = await profileManager.deleteProfile(activeGatewayId, profile.id);
            if (deleted) {
              removeProfile(profile.id);
              // If we deleted the active profile, switch to default
              if (profile.id === activeProfileId) {
                const defaultId = profiles.find((p) => p.isDefault)?.id || "default";
                setActiveProfile(defaultId);
                sessionManager.setActiveProfile(defaultId);
              }
            }
          },
        },
      ],
    );
  };

  if (!activeGatewayId || profiles.length === 0) return null;

  return (
    <>
      {/* Inline profile badge — tappable */}
      <TouchableOpacity onPress={() => { console.log("[ProfilePicker] Opening sheet"); setShowSheet(true); }} style={styles.badge}>
        <View style={[styles.avatar, { backgroundColor: activeProfile?.avatarColor || "#3B82F6" }]}>
          <Text style={styles.avatarText}>
            {(activeProfile?.displayName || "?")[0].toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.badgeName, { color: theme.textSecondary }]} numberOfLines={1}>
          {activeProfile?.displayName || "Profile"}
        </Text>
      </TouchableOpacity>

      {/* Bottom sheet */}
      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSheet(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.card }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Profiles</Text>

            {editingProfile ? (
              /* ─── Edit Profile View ─── */
              <View style={styles.editSection}>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View style={[styles.editAvatar, { backgroundColor: editColor }]}>
                    <Text style={styles.editAvatarText}>
                      {(editName || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Display Name</Text>
                <TextInput
                  style={[styles.createInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background, marginBottom: 12 }]}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                  placeholder="Name"
                  placeholderTextColor={theme.textTertiary}
                />

                <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Color</Text>
                <View style={styles.colorGrid}>
                  {AVATAR_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setEditColor(color)}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color },
                        editColor === color && styles.colorSwatchSelected,
                      ]}
                    >
                      {editColor === color && <Check size={14} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={() => setEditingProfile(null)}
                    style={[styles.editBtn, { borderColor: theme.border, borderWidth: 1 }]}
                  >
                    <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveEdit}
                    style={[styles.editBtn, { backgroundColor: theme.primary }]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>Save</Text>
                  </TouchableOpacity>
                </View>

                {!editingProfile.isDefault && (
                  <TouchableOpacity
                    onPress={() => { handleDelete(editingProfile); setEditingProfile(null); }}
                    style={styles.editDeleteBtn}
                  >
                    <Trash2 size={14} color="#EF4444" />
                    <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 13 }}>Delete Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              /* ─── Profile List View ─── */
              <>
                <ScrollView style={styles.profileList}>
                  {profiles.map((profile) => (
                    <TouchableOpacity
                      key={profile.id}
                      onPress={() => handleSwitch(profile)}
                      onLongPress={() => handleEdit(profile)}
                      style={[
                        styles.profileRow,
                        profile.id === activeProfileId && { backgroundColor: theme.primary + "10" },
                      ]}
                    >
                      <View style={[styles.profileAvatar, { backgroundColor: profile.avatarColor || "#3B82F6" }]}>
                        <Text style={styles.profileAvatarText}>
                          {profile.displayName[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: theme.text }]}>
                          {profile.displayName}
                        </Text>
                        {profile.isDefault && (
                          <Text style={[styles.profileMeta, { color: theme.textTertiary }]}>Default</Text>
                        )}
                      </View>
                      {profile.id === activeProfileId && (
                        <Check size={16} color={theme.primary} />
                      )}
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); handleEdit(profile); }}
                        hitSlop={8}
                        style={styles.deleteBtn}
                      >
                        <Text style={{ color: theme.textTertiary, fontSize: 12 }}>Edit</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {showCreate ? (
                  <View style={styles.createRow}>
                    <TextInput
                      style={[styles.createInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                      placeholder="Name (e.g. Amara)"
                      placeholderTextColor={theme.textTertiary}
                      value={newName}
                      onChangeText={setNewName}
                      autoFocus
                      onSubmitEditing={handleCreate}
                    />
                    <TouchableOpacity onPress={handleCreate} style={[styles.createBtn, { backgroundColor: theme.primary }]}>
                      <Check size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowCreate(false); setNewName(""); }}>
                      <X size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
                    <Plus size={14} color={theme.primary} />
                    <Text style={[styles.addBtnText, { color: theme.primary }]}>Add Profile</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity onPress={() => { setShowSheet(false); setEditingProfile(null); }} style={styles.closeBtn}>
              <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 14 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  badgeName: {
    fontSize: 12,
    fontWeight: "500",
    maxWidth: 80,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "60%",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  profileList: {
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: "600",
  },
  profileMeta: {
    fontSize: 11,
  },
  deleteBtn: {
    padding: 6,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  editSection: {
    marginBottom: 12,
  },
  editAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  editLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  editBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  editDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
});
