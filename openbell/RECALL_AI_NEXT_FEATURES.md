# Recall.ai Integration — Next Features Roadmap

**Date:** 2026-03-25
**Status:** Planned
**Reference:** https://docs.recall.ai/docs
**Current Integration:** Gateway + Inference dual routing, real-time transcript, client-side context injection, action items with Kanban/Board push

---

## Phase 5: High Value Features

### 1. Perfect Diarization (Speaker Names)

**Problem:** Transcript currently shows "Speaker" for all participants instead of actual names.

**Solution:** Enable Recall.ai's perfect diarization, which transcribes separate per-participant audio streams instead of a single mixed stream. This accurately attributes words to specific speakers, even during cross-talk.

**Recall.ai API:**
- Set `recording_config.transcript.provider.recallai_streaming` with separate audio streams
- Available for Zoom, Meet, Teams (not Desktop SDK)
- Cost: ~1.8x standard transcription credits for real-time (~$0.27/hr instead of $0.15/hr)

**Implementation:**
- Backend: Update `recallBotService.ts` deploy payload to enable per-participant audio and perfect diarization
- Mobile: No changes — speaker names already display in `MeetingTranscriptPanel`
- Effort: Low (config change in bot creation payload)

**Impact:** Immediately fixes the biggest UX issue — users can see who said what.

---

### 2. Bot Chat Messages (Send to Meeting)

**Problem:** Agent insights (action items, summaries, flags) are only visible in the ClawMobile app. Other meeting participants can't see them.

**Solution:** Use Recall.ai's chat API to send messages INTO the meeting chat from the bot. When an agent detects something valuable, the bot posts it in the Zoom/Meet/Teams chat for everyone.

**Recall.ai API:**
- `POST /api/v1/bot/{bot_id}/send_chat_message/`
- Parameters: `to` (recipient), `message` (text), `pin` (optional, Meet only)
- Platform support:

| Platform | Supported | Recipients | Char Limit |
|----------|-----------|------------|------------|
| Zoom | Yes | everyone, host, DM to participant | 4096 |
| Google Meet | Yes | everyone (+ pin support) | 500 |
| Teams | Yes | everyone | 4096 |
| Slack Huddles | Yes | everyone | — |
| Webex | No | — | — |

**Implementation:**
- Backend: New endpoint `POST /api/v1/recall/bot/:botId/chat` that proxies to Recall.ai chat API
- Mobile: New "Share to Meeting" button on action items and agent messages
- New tool definition: `meeting.shareToChat(message)` — agent can post directly to meeting chat
- Auto-share options: post summary before bot leaves, post action items as they're confirmed
- Effort: Medium

**Use Cases:**
- Agent detects action item → bot posts "[Action Item] Sarah: API migration by April 15" in Zoom chat
- Meeting ends → bot posts summary in chat before leaving
- User confirms an action item → bot shares it with all participants
- Agent flags a risk → bot posts a discrete alert

---

### 3. Calendar Integration (Auto-Deploy Bots)

**Problem:** Users must manually paste a meeting URL to deploy the bot. This requires opening the app, expanding the panel, pasting the URL, and tapping deploy for every meeting.

**Solution:** Connect Google Calendar or Outlook via OAuth. The bot automatically deploys to upcoming meetings without user intervention.

**Recall.ai API:**
- Calendar V2 (recommended): highly customizable, webhook-driven
- Calendar V1: faster setup, less control
- Handles: event updates, bot deduplication, participant emails, rescheduling
- Supports: Google Calendar, Microsoft Outlook

**Implementation:**
- Backend: OAuth flow for Google Calendar / Microsoft Graph API
- Backend: Calendar webhook handler — creates bot when meeting starts
- Backend: User preferences: which meetings to auto-join, agent presets per calendar
- Mobile: New "Calendar" section in Settings — connect Google/Outlook account
- Mobile: Calendar event list showing upcoming meetings with auto-join toggle
- Mobile: Per-meeting agent preset selection (e.g., "Contract Watchdog for legal meetings")
- Effort: High (OAuth, calendar sync, preference management)

**Use Cases:**
- User connects Google Calendar → all Zoom meetings auto-get a meeting bot
- User sets "Contract Watchdog" preset for meetings with "legal" in the title
- Recurring standup → auto-join with "Action Tracker" preset every time
- User can exclude specific meetings or calendar categories

---

### 4. Speaker Timeline (Who's Talking When)

**Problem:** No visibility into speaking patterns — who dominates conversations, who stays silent, when engagement drops.

**Solution:** Use Recall.ai's real-time `speech_on` / `speech_off` events per participant to track speaking time distribution and patterns.

**Recall.ai API:**
- Real-time endpoints subscribed to `speech_on` and `speech_off` events
- Timestamps relative to recording start
- Zoom: frequent events based on audio levels
- Other platforms: events on speaker changes

**Implementation:**
- Backend: Subscribe to speech events in `realtime_endpoints` config during bot creation
- Backend: New webhook handler for speech events, maintain per-participant speaking time map
- Backend: Include speaking stats in poll endpoint response
- Mobile: Speaking time visualization in transcript panel (bar chart per speaker)
- Mobile: "Currently speaking" indicator with speaker name
- Mobile: Feed speaking data to Participant Analyst agent preset
- Effort: Medium

**Use Cases:**
- Real-time: "John is speaking" indicator in the app
- Post-meeting: "Sarah spoke 40%, John 35%, others 25%"
- Agent insight: "Energy dropped when budget was discussed — 3 participants went silent"
- Meeting quality: identify meetings dominated by one person

---

## Phase 6: Medium Value Features

### 5. Participant Events (Camera/Mic/Screenshare Detection)

**Problem:** No awareness of participant behavior changes during the meeting.

**Solution:** Capture real-time events when participants toggle camera, microphone, or start/stop screen sharing.

**Recall.ai API:**
- Real-time participant events: camera on/off, mic on/off, screenshare start/stop, chat messages, join/leave
- Delivered via webhooks or real-time endpoints

**Implementation:**
- Backend: Subscribe to participant events in bot creation config
- Backend: Webhook handler for participant events, store in session
- Mobile: Event indicators in transcript panel ("Sarah started screen sharing")
- Mobile: Auto-trigger visual analysis when screenshare detected (switch to Inference mode)
- Effort: Medium

**Use Cases:**
- "Screen share detected — switching to slide analysis mode"
- "3 participants turned cameras off during the budget discussion"
- "John left the meeting at 2:15 PM"
- Agent context: participant behavior enriches agent reasoning

---

### 6. Bot Audio Output (Bot Speaks in Meeting)

**Problem:** Agent insights are only visible in the app. Other participants don't benefit unless the user manually relays information.

**Solution:** The bot speaks aloud in the meeting using TTS. Combined with ElevenLabs (already integrated in the app), the agent can voice its responses.

**Recall.ai API:**
- Audio output via WebSocket or API endpoint
- Bot unmutes and plays audio into the meeting
- All participants hear the bot speak

**Implementation:**
- Backend: TTS service generates audio from agent text responses
- Backend: Stream audio to Recall.ai bot via output API
- Mobile: "Speak to meeting" toggle per agent response
- Mobile: Voice selection (reuse existing ElevenLabs voice picker)
- Safety: require user confirmation before bot speaks (avoid accidental interruptions)
- Effort: Medium

**Use Cases:**
- Meeting ends → bot speaks: "Quick summary: 3 action items were captured..."
- User asks agent a question → bot voices the answer for all participants
- Agent detects a risk → bot says: "Just a note — that commitment may have compliance implications"
- Voice assistant mode: bot actively participates in the meeting

---

### 7. Bot Video Output (Display in Camera Feed)

**Problem:** The bot's video tile is blank (camera off). Wasted visual real estate.

**Solution:** Display images, dashboards, or slides through the bot's camera feed or screen share.

**Recall.ai API:**
- Video output via the bot's camera feed
- Screen share output (bot shares its screen)
- Can display images, rendered HTML, or video

**Implementation:**
- Backend: Render action items / summary as an image → push to bot video output
- Backend: Live dashboard showing detected action items, updated in real-time
- Mobile: Toggle "Show dashboard in meeting" option
- Effort: High (image rendering pipeline)

**Use Cases:**
- Bot's video tile shows a live action items list during the meeting
- Bot screen-shares a summary slide at the end of the meeting
- Visual annotations displayed alongside the discussion

---

### 8. Receiving Chat Messages (Read Meeting Chat)

**Problem:** Messages sent in the meeting chat (links, questions, comments) are not captured by the agent.

**Solution:** Capture incoming chat messages from participants and feed them into the agent context alongside the transcript.

**Recall.ai API:**
- Chat messages delivered via participant events or real-time endpoints
- Includes sender, message text, timestamp

**Implementation:**
- Backend: Subscribe to chat events in bot creation config
- Backend: Include chat messages in transcript buffer (tagged as [Chat])
- Mobile: Chat messages appear in transcript panel with distinct styling
- Context injection: chat messages included in [MEETING CONTEXT] block
- Effort: Low-Medium

**Use Cases:**
- "John shared a link in chat: https://..." → agent can reference it
- "Sarah asked in chat: What's the timeline?" → agent includes in summary
- Chat + voice: complete picture of all meeting communication

---

## Phase 7: Polish Features

### 9. Meeting Metadata

Capture meeting title, scheduled time, recurring meeting ID from Recall.ai. Use for:
- Organizing transcripts by meeting series
- Linking related meetings (e.g., weekly standups)
- Pre-loading agent context from previous meetings in the same series

### 10. Customizable Auto-Leave Rules

Configure when the bot should automatically leave:
- Everyone left the meeting
- Silence for X minutes
- Only bots remain
- Meeting exceeds X hours (cost control)
- Recording permission denied

Already partially handled by Recall.ai defaults, but exposing these as user preferences in Settings.

---

## Cost Summary

| Feature | Additional Cost | Notes |
|---------|----------------|-------|
| Perfect Diarization | +$0.12/hr | 1.8x transcription vs 1x |
| Bot Chat Messages | Free | Included in base recording cost |
| Calendar Integration | Free | No additional Recall.ai cost |
| Speaker Timeline | Free | Included in participant events |
| Participant Events | Free | Included in base recording |
| Bot Audio Output | TTS cost only | ElevenLabs: ~$0.01-0.05 per utterance |
| Bot Video Output | Free | Included in base recording |
| Receiving Chat | Free | Included in participant events |

**Current cost:** $0.65/hr (recording + transcription)
**With perfect diarization:** $0.77/hr
**With all features:** ~$0.80/hr + TTS costs

---

## Build Order Recommendation

| Order | Feature | Effort | Why First |
|-------|---------|--------|-----------|
| 1 | Perfect Diarization | Low | Fixes "Speaker" name issue — biggest current UX gap |
| 2 | Bot Chat Messages | Medium | Makes bot valuable to ALL participants, not just app user |
| 3 | Speaker Timeline | Medium | Enables participation analytics, feeds Participant Analyst |
| 4 | Receiving Chat Messages | Low-Medium | Completes the meeting context picture |
| 5 | Calendar Auto-Deploy | High | Eliminates manual URL pasting — convenience multiplier |
| 6 | Bot Audio Output | Medium | Transforms bot from observer to active participant |
| 7 | Participant Events | Medium | Behavioral intelligence, auto-mode switching |
| 8 | Bot Video Output | High | Visual dashboard in meeting — impressive but complex |
