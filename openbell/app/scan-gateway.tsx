import { useState, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, QrCode, Keyboard, AlertCircle, CheckCircle2, Clock } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { decodeQRPayload, toGatewayConfig } from "@/services/gateway/qrPairing";
import { pairingService } from "@/services/gateway/pairingService";

type ScanState =
  | { step: "scanning" }
  | { step: "connecting"; gatewayName: string }
  | { step: "waiting-approval"; gatewayName: string }
  | { step: "approved" }
  | { step: "error"; message: string };

export default function ScanGatewayScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const {
    addGateway,
    setActiveGateway,
    setConnectionStatus,
    setApprovalStatus,
    connectionStatus,
    approvalStatus,
  } = useGatewayStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ step: "scanning" });
  const hasScanned = useRef(false);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      // Prevent double-scanning
      if (hasScanned.current) return;
      hasScanned.current = true;

      const result = decodeQRPayload(data);

      if (!result.success) {
        setState({ step: "error", message: result.error });
        hasScanned.current = false;
        return;
      }

      const { payload } = result;
      const config = toGatewayConfig(payload);

      setState({ step: "connecting", gatewayName: config.name });

      try {
        // Save the gateway config
        addGateway(config);
        setActiveGateway(config.id);
        await pairingService.saveGateway(config);

        // Connection will be handled by useGateway hook
        // which watches activeGatewayId changes.
        // Transition to waiting-approval state.
        setState({ step: "waiting-approval", gatewayName: config.name });
        setApprovalStatus("pending");

        // The useGateway hook + PairingService will handle:
        // 1. WebSocket connect with bootstrapToken
        // 2. Listening for auth_result (approval)
        // 3. Marking as paired
        // When connectionStatus becomes "connected", we navigate away.
      } catch (err) {
        setState({
          step: "error",
          message: "Failed to save gateway configuration",
        });
        hasScanned.current = false;
      }
    },
    [addGateway, setActiveGateway, setApprovalStatus],
  );

  const handleClose = () => {
    router.back();
  };

  const handleRetry = () => {
    hasScanned.current = false;
    setState({ step: "scanning" });
    setApprovalStatus(null);
  };

  // Navigate to chat when connected
  if (connectionStatus === "connected" && state.step === "waiting-approval") {
    setApprovalStatus("approved");
    router.replace("/(tabs)/openclaw");
    return null;
  }

  // Camera permission not yet determined
  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  // Camera permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centered}>
          <AlertCircle size={48} color={theme.textTertiary} />
          <Text style={[styles.title, { color: theme.text }]}>Camera Access Required</Text>
          <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
            ClawMobile needs camera access to scan your Gateway's QR code.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.primaryButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={styles.secondaryButton}>
            <Text style={[styles.secondaryButtonText, { color: theme.textTertiary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#000" }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <X size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {state.step === "scanning" ? "Scan QR Code" : "Connecting"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Content */}
      {state.step === "scanning" && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          {/* QR Overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanHint}>
              Point at the QR code in your Gateway dashboard
            </Text>
          </View>
        </View>
      )}

      {state.step === "connecting" && (
        <View style={[styles.statusContainer, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.statusTitle, { color: theme.text }]}>
            Connecting to Gateway...
          </Text>
          <Text style={[styles.statusSubtitle, { color: theme.textTertiary }]}>
            {state.gatewayName}
          </Text>
        </View>
      )}

      {state.step === "waiting-approval" && (
        <View style={[styles.statusContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primary + "20" }]}>
            <Clock size={32} color={theme.primary} />
          </View>
          <Text style={[styles.statusTitle, { color: theme.text }]}>
            Waiting for Approval
          </Text>
          <Text style={[styles.statusSubtitle, { color: theme.textTertiary }]}>
            Ask the Gateway owner to approve this device:
          </Text>
          <View style={[styles.codeBlock, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.codeText, { color: theme.text }]}>
              openclaw devices list{"\n"}
              openclaw devices approve {"<requestId>"}
            </Text>
          </View>
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
          <TouchableOpacity onPress={handleClose} style={[styles.cancelLink, { marginTop: 24 }]}>
            <Text style={[styles.secondaryButtonText, { color: theme.textTertiary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.step === "error" && (
        <View style={[styles.statusContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.iconCircle, { backgroundColor: "#FF3B3020" }]}>
            <AlertCircle size={32} color="#FF3B30" />
          </View>
          <Text style={[styles.statusTitle, { color: theme.text }]}>
            Connection Failed
          </Text>
          <Text style={[styles.statusSubtitle, { color: theme.textTertiary }]}>
            {state.message}
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={styles.cancelLink}>
            <Text style={[styles.secondaryButtonText, { color: theme.textTertiary }]}>
              Set Up Manually
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer hint (scanning state only) */}
      {state.step === "scanning" && (
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleClose} style={styles.footerLink}>
            <Keyboard size={16} color="#999" />
            <Text style={styles.footerText}>Enter code manually instead</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const SCAN_SIZE = 260;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFF",
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#FFF",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginTop: 24,
    textAlign: "center",
  },
  statusContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  statusSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  codeBlock: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    width: "100%",
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    marginTop: 20,
    width: "100%",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
  },
  cancelLink: {
    paddingVertical: 12,
  },
  footer: {
    paddingBottom: 16,
    alignItems: "center",
  },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  footerText: {
    color: "#999",
    fontSize: 14,
  },
});
