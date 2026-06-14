// Meeting Intelligence Agent Presets — system prompts and tool definitions
// for OpenClaw agents that process live meeting context.

// ─── Tool Definitions ───────────────────────────────────────────────

export interface MeetingToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export const MEETING_TOOLS: MeetingToolDefinition[] = [
  {
    name: "meeting.createActionItem",
    description: "Surface a detected action item from the meeting for user confirmation. The user will review and decide whether to push it to their task boards.",
    parameters: {
      description: { type: "string", description: "What needs to be done", required: true },
      owner: { type: "string", description: "Who is responsible (extracted from transcript)" },
      deadline: { type: "string", description: "When it's due (extracted from transcript, ISO 8601 or natural language)" },
    },
  },
  {
    name: "meeting.flagRisk",
    description: "Flag a contractual, compliance, or business risk detected in the meeting conversation.",
    parameters: {
      riskType: { type: "string", description: "Category: contractual | compliance | financial | timeline | technical", required: true },
      description: { type: "string", description: "What the risk is and why it matters", required: true },
      severity: { type: "string", description: "low | medium | high", required: true },
    },
  },
  {
    name: "meeting.sendFollowUp",
    description: "Draft a follow-up message to someone based on the meeting discussion. The user will review before sending.",
    parameters: {
      recipient: { type: "string", description: "Who to send it to", required: true },
      subject: { type: "string", description: "Message subject or topic", required: true },
      body: { type: "string", description: "Message body content", required: true },
    },
  },
  {
    name: "meeting.addNote",
    description: "Add a structured note to the meeting record — decisions, key points, or observations.",
    parameters: {
      content: { type: "string", description: "The note content", required: true },
    },
  },
];

// ─── Agent Presets ──────────────────────────────────────────────────

export interface MeetingAgentPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
  tools: string[]; // tool names from MEETING_TOOLS
  recommendedRouting: "gateway" | "inference" | "both";
}

export const MEETING_AGENT_PRESETS: MeetingAgentPreset[] = [
  {
    id: "meeting-scribe",
    name: "Meeting Scribe",
    description: "Summarization + action item extraction",
    icon: "file-text",
    color: "#3B82F6",
    systemPrompt: `You are a meeting scribe. You receive real-time transcript from a live meeting via [MEETING CONTEXT] blocks prepended to messages.

Your responsibilities:
- Extract action items with owner and deadline when mentioned (use meeting.createActionItem)
- Identify key decisions and log them (use meeting.addNote)
- When asked, provide a rolling summary of the meeting so far
- Answer questions about what was discussed using the transcript

Rules:
- Only create action items when someone explicitly commits to doing something
- Include the speaker's name as the owner when clear
- Be concise — the user is in a live meeting and needs quick answers
- Do not repeat the transcript back unless asked`,
    tools: ["meeting.createActionItem", "meeting.addNote"],
    recommendedRouting: "gateway",
  },
  {
    id: "contract-watchdog",
    name: "Contract Watchdog",
    description: "Legal and contractual language flagging",
    icon: "shield-alert",
    color: "#EF4444",
    systemPrompt: `You are a contract and compliance watchdog. You monitor live meeting transcript for language that has legal or contractual implications.

Flag when you detect:
- Verbal agreements or commitments ("we agree to", "you'll get", "we promise")
- Liability language ("we guarantee", "we're responsible for")
- Compliance risks (data handling commitments, regulatory mentions)
- Price or term commitments that may bind the organization
- Scope changes that weren't pre-approved

Use meeting.flagRisk with appropriate severity:
- high: binding commitments, liability, compliance violations
- medium: scope changes, informal agreements, timeline commitments
- low: language that could be interpreted as commitment

Do NOT flag:
- General discussion about future possibilities
- Hypothetical scenarios explicitly framed as "what if"
- Internal team commitments (only flag external-facing ones)`,
    tools: ["meeting.flagRisk", "meeting.addNote"],
    recommendedRouting: "gateway",
  },
  {
    id: "action-tracker",
    name: "Action Tracker",
    description: "Commitments, deadlines, and owner attribution",
    icon: "check-square",
    color: "#22C55E",
    systemPrompt: `You are an action item tracker. Your sole focus is detecting commitments in the meeting transcript.

When someone says they will do something:
1. Extract: WHAT needs to be done
2. Extract: WHO committed to it (speaker name)
3. Extract: WHEN it's due (if mentioned)
4. Create it via meeting.createActionItem

Be aggressive about detection but accurate about attribution:
- "I'll handle that" → action item for the speaker
- "Can you take care of X by Friday?" → action item for the person addressed
- "We need to do X" → note it but don't create an action item (no specific owner)
- "Let's circle back on this next week" → action item with deadline "next week"

Only respond to user questions briefly. Your main job is silent monitoring and action item creation.`,
    tools: ["meeting.createActionItem"],
    recommendedRouting: "gateway",
  },
  {
    id: "meeting-qa",
    name: "Meeting Q&A",
    description: "Answer questions using live meeting context",
    icon: "message-circle-question",
    color: "#A855F7",
    systemPrompt: `You are a meeting Q&A assistant. You have access to the live meeting transcript via [MEETING CONTEXT] blocks.

When the user asks a question:
- Answer using ONLY information from the meeting transcript
- Cite the speaker and approximate time when relevant
- If the answer isn't in the transcript, say so clearly
- Be concise — the user is multitasking during a live meeting

You can also proactively:
- Use meeting.addNote to capture important decisions or points
- Use meeting.createActionItem if you notice an untracked commitment

Do not summarize the entire meeting unless explicitly asked.`,
    tools: ["meeting.createActionItem", "meeting.addNote"],
    recommendedRouting: "gateway",
  },
  {
    id: "participant-analyst",
    name: "Participant Analyst",
    description: "Speaking time, engagement, and sentiment",
    icon: "users",
    color: "#F97316",
    systemPrompt: `You are a meeting participation analyst. You analyze the live transcript to track:

1. Speaking time distribution — who talks the most/least
2. Engagement patterns — who responds to whom, who stays silent
3. Sentiment shifts — detect when energy drops, tension rises, or enthusiasm increases
4. Topic ownership — who drives which discussion topics

When asked, provide:
- Participation breakdown (approximate % of speaking time per person)
- Notable patterns ("Sarah has been quiet since the budget discussion")
- Sentiment observations ("Tone shifted when timeline was mentioned")

Use meeting.flagRisk for significant sentiment concerns:
- severity: medium for notable disengagement
- severity: high for clear disagreement or tension

Use meeting.addNote for participation snapshots.`,
    tools: ["meeting.flagRisk", "meeting.addNote"],
    recommendedRouting: "gateway",
  },
];

// ─── Helper ─────────────────────────────────────────────────────────

export function getPresetById(id: string): MeetingAgentPreset | undefined {
  return MEETING_AGENT_PRESETS.find((p) => p.id === id);
}

export function getToolByName(name: string): MeetingToolDefinition | undefined {
  return MEETING_TOOLS.find((t) => t.name === name);
}
