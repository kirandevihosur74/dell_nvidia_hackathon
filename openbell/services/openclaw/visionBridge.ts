/**
 * Vision Bridge — gives the OpenClaw agent sight via a two-stage pipeline:
 *
 * Stage 1: Capture frame → Gemini API (direct) → visual description
 * Stage 2: Visual description + user question → OpenClaw gateway (Claude) → reasoning + tool use
 *
 * Uses the Gemini API directly (same key stored in Settings) for reliable,
 * synchronous image analysis — no dependency on StreamIO backend or WebSocket events.
 */

import { safelyTakePhoto } from "@/services/streamio/cameraRef";
import { getSecure } from "@/utils/secureStore";

interface VisionResult {
  description: string;
  success: boolean;
}

const GEMINI_VISION_MODEL = "gemini-2.5-flash";

/**
 * Capture a frame from the live camera (with timeout) and send it
 * directly to Gemini for visual analysis. Returns a text description.
 */
export async function captureAndDescribe(
  userQuestion: string
): Promise<VisionResult> {
  // 1. Capture frame with a 3s timeout so it can't hang
  let imageBase64: string | null = null;
  try {
    imageBase64 = await Promise.race([
      safelyTakePhoto(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
  } catch {
    console.warn("[VisionBridge] Frame capture failed");
  }

  if (!imageBase64) {
    console.warn("[VisionBridge] No frame captured, skipping vision");
    return { description: "", success: false };
  }

  // 2. Send directly to Gemini
  return describeFrame(imageBase64, userQuestion);
}

/**
 * Send a base64 image frame directly to Gemini API for visual analysis.
 */
export async function describeFrame(
  imageBase64: string,
  userQuestion: string
): Promise<VisionResult> {
  try {
    const apiKey = await getSecure("settings_gemini_api_key");
    if (!apiKey) {
      console.warn("[VisionBridge] No Gemini API key found in settings");
      return { description: "", success: false };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              text: `You are a vision assistant. Describe what you see in this image in detail, focusing on what is relevant to the user's question.\n\nUser's question: "${userQuestion}"\n\nProvide a thorough visual description that will help another AI agent understand the scene and take action if needed.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn("[VisionBridge] Gemini API error:", response.status, errText);
      return { description: "", success: false };
    }

    const result = await response.json();
    const description =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (description) {
      return { description, success: true };
    }

    return { description: "", success: false };
  } catch (err: any) {
    console.warn("[VisionBridge] Gemini call failed:", err.message);
    return { description: "", success: false };
  }
}

/**
 * Build an enriched message that gives the OpenClaw agent visual context
 * from the live stream, so it can reason and use tools based on what it sees.
 */
export function buildVisionEnrichedMessage(
  userQuestion: string,
  visionDescription: string
): string {
  return (
    `[Live Stream Visual Context]\n` +
    `The following is a description of what the user's live camera stream currently shows:\n` +
    `---\n` +
    `${visionDescription}\n` +
    `---\n\n` +
    `User's question about the live stream: ${userQuestion}`
  );
}
