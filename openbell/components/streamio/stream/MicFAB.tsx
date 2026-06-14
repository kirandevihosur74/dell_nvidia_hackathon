// MicFAB — Floating action button for Live Q&A push-to-talk
//
// States: idle → recording → processing → waiting → speaking
// Barge-in: tap during speaking → interrupt TTS, start recording

import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Mic, Volume2, MessageCircle } from 'lucide-react-native';
import { QAStatus } from '@/types/streamio/inference';

interface MicFABProps {
  visible: boolean;
  qaStatus: QAStatus;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onInterrupt: () => void;
  fullscreen?: boolean;
}

export const MicFAB: React.FC<MicFABProps> = ({
  visible,
  qaStatus,
  onStartRecording,
  onStopRecording,
  onInterrupt,
  fullscreen = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Fade in/out
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // Pulsing animation for recording and speaking states
  useEffect(() => {
    if (qaStatus === 'recording' || qaStatus === 'speaking') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [qaStatus]);

  if (!visible) return null;

  const handlePress = () => {
    switch (qaStatus) {
      case 'idle':
        onStartRecording();
        break;
      case 'recording':
        onStopRecording();
        break;
      case 'speaking':
        // Barge-in: interrupt TTS, then start new recording
        onInterrupt();
        onStartRecording();
        break;
      case 'processing':
        // Ignore taps while processing
        break;
    }
  };

  const size = fullscreen ? 64 : 56;
  const offset = fullscreen ? 20 : 16;
  const bgColor = getBackgroundColor(qaStatus);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity: opacityAnim,
          top: offset + 40,
          left: offset,
        },
      ]}
    >
      {/* Listening banner */}
      {qaStatus === 'recording' && (
        <View style={styles.listeningBanner}>
          <View style={styles.listeningDot} />
          <Text style={styles.listeningText}>Listening...</Text>
        </View>
      )}

      {/* Pulse ring */}
      {(qaStatus === 'recording' || qaStatus === 'speaking') && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size + 16,
              height: size + 16,
              borderRadius: (size + 16) / 2,
              borderColor: qaStatus === 'recording' ? '#EF4444' : '#8B5CF6',
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}

      {/* Main button */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
          },
        ]}
      >
        {renderIcon(qaStatus)}
      </TouchableOpacity>
    </Animated.View>
  );
};

function getBackgroundColor(status: QAStatus): string {
  switch (status) {
    case 'idle':
      return 'rgba(0, 0, 0, 0.6)';
    case 'recording':
      return '#EF4444';
    case 'processing':
      return 'rgba(0, 0, 0, 0.6)';
    case 'speaking':
      return '#8B5CF6';
    default:
      return 'rgba(0, 0, 0, 0.6)';
  }
}

function renderIcon(status: QAStatus): React.ReactNode {
  switch (status) {
    case 'idle':
      return <Mic size={24} color="#FFFFFF" />;
    case 'recording':
      return <Mic size={24} color="#FFFFFF" />;
    case 'processing':
      return <ActivityIndicator size="small" color="#FFFFFF" />;
    case 'speaking':
      return <Volume2 size={24} color="#FFFFFF" />;
    default:
      return <Mic size={24} color="#FFFFFF" />;
  }
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 100,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.4,
  },
  listeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  listeningText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
