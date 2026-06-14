import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { spacing } from '@/constants/spacing';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import * as ShareService from '@/services/streamio/shareService';
import * as Haptics from 'expo-haptics';
import {
  X,
  Copy,
  Share2,
  Globe,
  Lock,
  ExternalLink,
  MessageCircle,
  Mail,
  Send,
} from 'lucide-react-native';

interface StreamShareSheetProps {
  visible: boolean;
  onClose: () => void;
}

const PLATFORMS = [
  { key: 'twitter' as const, label: 'X / Twitter', icon: ExternalLink, color: '#1DA1F2' },
  { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
  { key: 'telegram' as const, label: 'Telegram', icon: Send, color: '#0088cc' },
  { key: 'email' as const, label: 'Email', icon: Mail, color: '#6366F1' },
  { key: 'sms' as const, label: 'SMS', icon: MessageCircle, color: '#10B981' },
  { key: 'linkedin' as const, label: 'LinkedIn', icon: ExternalLink, color: '#0A66C2' },
  { key: 'reddit' as const, label: 'Reddit', icon: ExternalLink, color: '#FF4500' },
  { key: 'facebook' as const, label: 'Facebook', icon: ExternalLink, color: '#1877F2' },
];

export const StreamShareSheet: React.FC<StreamShareSheetProps> = ({
  visible,
  onClose,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const publicUrl = useStreamIOStreamStore((s) => s.publicUrl);
  const streamUrl = useStreamIOStreamStore((s) => s.streamUrl);
  const activeStreamId = useStreamIOStreamStore((s) => s.activeStreamId);
  const [isPublishing, setIsPublishing] = useState(false);

  const shareUrl = publicUrl || streamUrl;
  const isPublic = !!publicUrl;

  const handleMakePublic = async () => {
    if (!activeStreamId) return;
    setIsPublishing(true);
    const url = await ShareService.makeStreamPublic(activeStreamId);
    setIsPublishing(false);
    if (url) {
      console.warn('[StreamIO]', 'Stream is now public');
    } else {
      console.warn('[StreamIO]', 'Failed to make stream public');
    }
  };

  const handleMakePrivate = async () => {
    if (!activeStreamId) return;
    await ShareService.makeStreamPrivate(activeStreamId);
    console.warn('[StreamIO]', 'Stream is now private');
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    const copied = await ShareService.copyToClipboard(shareUrl);
    if (copied) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      console.warn('[StreamIO]', 'URL copied to clipboard');
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    await ShareService.shareUrl(shareUrl, 'Watch my StreamIO live stream');
  };

  const handlePlatformShare = async (platform: keyof ReturnType<typeof ShareService.getShareUrls>) => {
    if (!shareUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await ShareService.openSharePlatform(platform, shareUrl, 'Watch my live stream on StreamIO');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Share Stream</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Public/Private Toggle */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Visibility</Text>
            <View style={[styles.visibilityCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {isPublic ? (
                <>
                  <View style={styles.visibilityRow}>
                    <Globe size={20} color={theme.success} />
                    <Text style={[styles.visibilityText, { color: theme.text }]}>Public — Anyone with the link can watch</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: theme.primary }]}
                    onPress={handleMakePrivate}
                    activeOpacity={0.7}
                  >
                    <Lock size={16} color={theme.primary} />
                    <Text style={[styles.actionButtonText, { color: theme.primary }]}>Make Private</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.visibilityRow}>
                    <Lock size={20} color={theme.textTertiary} />
                    <Text style={[styles.visibilityText, { color: theme.text }]}>Private — Only accessible on your network</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.primary }]}
                    onPress={handleMakePublic}
                    activeOpacity={0.7}
                    disabled={isPublishing}
                  >
                    {isPublishing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Globe size={16} color="#FFFFFF" />
                        <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Make Public</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* URL Display */}
          {shareUrl && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Stream URL</Text>
              <View style={[styles.urlCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.urlText, { color: theme.text }]} numberOfLines={2} selectable>
                  {shareUrl}
                </Text>
                <View style={styles.urlActions}>
                  <TouchableOpacity style={[styles.urlButton, { backgroundColor: theme.primaryLight + '30' }]} onPress={handleCopy}>
                    <Copy size={18} color={theme.primary} />
                    <Text style={[styles.urlButtonText, { color: theme.primary }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.urlButton, { backgroundColor: theme.primaryLight + '30' }]} onPress={handleNativeShare}>
                    <Share2 size={18} color={theme.primary} />
                    <Text style={[styles.urlButtonText, { color: theme.primary }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Platform Sharing */}
          {shareUrl && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Share To</Text>
              <View style={styles.platformGrid}>
                {PLATFORMS.map((platform) => (
                  <TouchableOpacity
                    key={platform.key}
                    style={styles.platformButton}
                    onPress={() => handlePlatformShare(platform.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.platformIcon, { backgroundColor: platform.color + '20' }]}>
                      <platform.icon size={20} color={platform.color} />
                    </View>
                    <Text style={[styles.platformLabel, { color: theme.textSecondary }]}>{platform.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {!shareUrl && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.textTertiary }]}>Start streaming to get a shareable URL</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 40 },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  visibilityCard: {
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  visibilityText: {
    flex: 1,
    fontSize: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  urlCard: {
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
  },
  urlText: {
    fontSize: 13,
    fontFamily: 'Menlo',
    lineHeight: 20,
  },
  urlActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  urlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  urlButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  platformButton: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
  },
  platformIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
