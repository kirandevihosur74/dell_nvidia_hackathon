// Inference overlay — renders bounding boxes and labels over the stream preview
//
// Reads annotation frames from inferenceStore and draws:
//   - Colored bounding boxes (2px border, agent-colored)
//   - Label pills (rounded rect + text) anchored to box top-left
//   - Confidence percentage (optional)
//   - Crossfade transition (300ms) when annotations update
//
// Uses React Native Animated views (no Skia dependency).
// Coordinates are normalized 0-1, scaled to container dimensions.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { Annotation, AnnotationFrame } from '@/types/streamio/inference';

interface InferenceOverlayProps {
  showConfidence?: boolean;
}

export const InferenceOverlay: React.FC<InferenceOverlayProps> = ({
  showConfidence = false,
}) => {
  const annotations = useStreamIOInferenceStore((s) => s.annotations);
  const viewerToggles = useStreamIOInferenceStore((s) => s.viewerToggles);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Collect all visible annotations across agents
  const visibleAnnotations: (Annotation & { agentId: string })[] = [];
  for (const [agentId, frame] of Object.entries(annotations)) {
    const toggle = viewerToggles[agentId];
    if (toggle && !toggle.annotationsVisible) continue;

    for (const annotation of frame.annotations) {
      visibleAnnotations.push({ ...annotation, agentId });
    }
  }

  // Crossfade on annotation change
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [annotations]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerSize({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  };

  if (containerSize.width === 0) {
    return <View style={styles.container} onLayout={onLayout} pointerEvents="none" />;
  }

  return (
    <View style={styles.container} onLayout={onLayout} pointerEvents="none">
      <Animated.View style={[styles.annotationLayer, { opacity: fadeAnim }]}>
        {visibleAnnotations.map((annotation, index) => (
          <BoundingBox
            key={`${annotation.agentId}-${index}-${annotation.label}`}
            annotation={annotation}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            showConfidence={showConfidence}
          />
        ))}
      </Animated.View>
    </View>
  );
};

// ─── Bounding Box Component ──────────────────────────────────────────

interface BoundingBoxProps {
  annotation: Annotation;
  containerWidth: number;
  containerHeight: number;
  showConfidence: boolean;
}

const BoundingBox: React.FC<BoundingBoxProps> = ({
  annotation,
  containerWidth,
  containerHeight,
  showConfidence,
}) => {
  const { x, y, width, height, label, confidence, color } = annotation;

  // Convert normalized coords to pixels
  const left = x * containerWidth;
  const top = y * containerHeight;
  const boxWidth = width * containerWidth;
  const boxHeight = height * containerHeight;

  const confidenceText = showConfidence ? ` ${Math.round(confidence * 100)}%` : '';

  return (
    <View
      style={[
        styles.boundingBox,
        {
          left,
          top,
          width: boxWidth,
          height: boxHeight,
          borderColor: color,
        },
      ]}
    >
      {/* Label pill */}
      <View style={[styles.labelPill, { backgroundColor: color }]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {label}{confidenceText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  annotationLayer: {
    flex: 1,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  labelPill: {
    position: 'absolute',
    top: -22,
    left: -2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 160,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
