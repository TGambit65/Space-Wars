# Phase 7: NPC Chat UI + Voice Interface (Frontend)

**Goal**: Player-facing dialogue panel with menu buttons, free-text input, and voice input/output.
**Dependencies**: Phase 3 (dialogue API), Phase 5 (WebSocket for real-time messages).
**Estimated files**: 5 new, 2 modified

---

## Task 7.1: Voice Chat Hook

**File**: `client/src/hooks/useVoiceChat.js` (NEW)

- [ ] Implement `useVoiceChat()` hook:
  ```javascript
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioContextRef = useRef(null);
  ```
- [ ] `startRecording()`:
  - Request microphone permission: `navigator.mediaDevices.getUserMedia({ audio: true })`
  - Create `MediaRecorder` with `mimeType: 'audio/webm;codecs=opus'`
  - Collect chunks in array
  - Set isRecording = true
  - Handle browser compatibility (check for MediaRecorder support)
- [ ] `stopRecording()`:
  - Stop MediaRecorder
  - Combine chunks into Blob
  - Set isRecording = false
  - Return audioBlob
- [ ] `playAudio(audioData)`:
  - Accept base64 string or ArrayBuffer
  - Create AudioContext if not exists
  - Decode audio data
  - Create buffer source, play
  - Set isPlaying = true during playback
  - Set isPlaying = false when ended
- [ ] `stopPlayback()`:
  - Stop current audio source
  - Set isPlaying = false
- [ ] `isVoiceSupported()`:
  - Check for MediaRecorder and getUserMedia support
  - Return boolean
- [ ] Return: `{ isRecording, isPlaying, startRecording, stopRecording, playAudio, stopPlayback, isVoiceSupported }`

## Task 7.2: Voice Button Component

**File**: `client/src/components/npc/VoiceButton.jsx` (NEW)

- [ ] Props: `{ onAudioCaptured, disabled, voiceEnabled, isPremium }`
- [ ] Uses `useVoiceChat` hook
- [ ] Render microphone icon button (Mic from lucide-react)
- [ ] Behavior: press-and-hold to record
  - `onMouseDown` / `onTouchStart` → start recording
  - `onMouseUp` / `onTouchEnd` → stop recording, call `onAudioCaptured(audioBlob)`
- [ ] Visual states:
  - Default: gray mic icon
  - Recording: red pulsing ring animation around mic, `bg-accent-red/20`
  - Disabled (voice not enabled): grayed out, tooltip "Voice not available"
  - Disabled (free tier): grayed out with upgrade icon, tooltip "Upgrade to Premium for voice chat"
  - Disabled (not supported): grayed out, tooltip "Browser does not support voice input"
- [ ] CSS animation for recording pulse:
  ```css
  @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.5); opacity: 0; } }
  ```

## Task 7.3: NPC Portrait Component

**File**: `client/src/components/npc/NPCPortrait.jsx` (NEW)

- [ ] Props: `{ npcType, size = 'md' }`
- [ ] Map NPC type to lucide-react icon + color:
  ```javascript
  const portraits = {
    PIRATE: { icon: Skull, color: 'text-accent-red', bg: 'bg-accent-red/20' },
    PIRATE_LORD: { icon: Crown, color: 'text-accent-red', bg: 'bg-accent-red/20' },
    TRADER: { icon: ShoppingCart, color: 'text-accent-green', bg: 'bg-accent-green/20' },
    PATROL: { icon: Shield, color: 'text-accent-cyan', bg: 'bg-accent-cyan/20' },
    BOUNTY_HUNTER: { icon: Crosshair, color: 'text-accent-orange', bg: 'bg-accent-orange/20' },
  };
  ```
- [ ] Render: circular container with icon centered, colored background
- [ ] Size variants: sm (8x8), md (12x12), lg (16x16)

## Task 7.4: NPC Chat Panel Component

**File**: `client/src/components/npc/NPCChatPanel.jsx` (NEW)

- [ ] Props: `{ npc, user, onClose, socket }`
- [ ] State:
  ```javascript
  const [messages, setMessages] = useState([]);       // { sender: 'npc'|'player', text, audio?, timestamp }
  const [menuOptions, setMenuOptions] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [inputText, setInputText] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState('free');
  ```
- [ ] On mount:
  - Call `dialogue.start(npc.npc_id)`
  - Set initial menu options from response
  - Set voiceEnabled from response (reflects both global setting AND user tier)
  - Set subscriptionTier from response
  - Add NPC greeting to messages

- [ ] **Header Section**:
  - NPCPortrait (left)
  - NPC name (bold)
  - Type badge: `badge-${typeColor}` with NPC type name
  - Ship type (smaller text)
  - Close button (X icon, top-right)

- [ ] **Messages Area** (scrollable, flex-grow):
  - NPC messages: left-aligned, dark card background, NPC type accent border-left
  - Player messages: right-aligned, `bg-accent-cyan/10` background
  - Each message shows:
    - Text content
    - Audio play button (if audio data exists and voice enabled)
    - Timestamp (relative: "just now", "2m ago")
  - "NPC is thinking..." indicator:
    - Shown when `isThinking` is true
    - Three animated dots: `...`
    - Left-aligned like NPC message
  - Auto-scroll to bottom on new messages

- [ ] **Menu Buttons Row** (above input):
  - Render available `menuOptions` as small buttons
  - Button style: `btn btn-secondary` with smaller text
  - Grid layout: 2-3 columns depending on count
  - On click:
    - Add player message to chat: "I selected: [option label]"
    - Set isThinking = true
    - Call `dialogue.selectOption(npc.npc_id, option.key)`
    - Add NPC response to messages
    - Update menu options from response
    - If response has audio, auto-play
    - Set isThinking = false
    - If response.data?.action, handle UI actions (e.g., 'open_trade_ui')

- [ ] **Input Area** (fixed at bottom):
  - Text input (flex-grow): placeholder "Type a message..."
  - Send button (Send icon from lucide-react)
  - VoiceButton component (if voice supported):
    - Pass `isPremium={subscriptionTier !== 'free'}` to VoiceButton
    - Free users see mic button grayed out with "Upgrade to Premium" tooltip
    - Clicking mic as free user shows inline upgrade prompt: "Voice chat is a premium feature. Upgrade your account to talk to NPCs!"
  - On text submit:
    - Add player message to chat
    - Clear input
    - Set isThinking = true
    - Call `dialogue.sendMessage(npc.npc_id, text)`
    - Add NPC response to messages
    - If response has audio, auto-play
    - Set isThinking = false
  - On voice captured:
    - Add player message: "[Voice message]" with audio playback
    - Set isThinking = true
    - Call `dialogue.sendVoice(npc.npc_id, audioBlob)`
    - If transcription returned, update player message text
    - Add NPC response to messages
    - Auto-play NPC audio response
    - Set isThinking = false

- [ ] **WebSocket integration**:
  - Listen for `npc:dialogue` events on socket (for proactive NPC messages)
  - If event matches current NPC, add to messages

- [ ] **Close / Farewell**:
  - Farewell button at bottom of menu options
  - On click: call `dialogue.end(npc.npc_id)`, show farewell message, then `onClose()`
  - Close (X) button also calls end dialogue

- [ ] **Positioning**:
  - Slide-in panel from right side of screen
  - Width: 400px (responsive: full-width on mobile)
  - Height: 70vh max
  - z-index above game UI but below modals
  - Backdrop: semi-transparent dark overlay on mobile

## Task 7.5: NPC Hail Notification Component

**File**: `client/src/components/npc/NPCHailNotification.jsx` (NEW)

- [ ] Props: `{ hails, onAccept, onDismiss }`
- [ ] `hails` is array from useNPCEvents: `[{ npc_id, name, npc_type, greeting_text, menu_options }]`
- [ ] Render notification bar for each pending hail (stack vertically, max 3):
  - Position: fixed top-right, below header
  - Animation: slide in from right
  - Content:
    - NPCPortrait (sm)
    - NPC name + type badge
    - Greeting text (truncated to 80 chars)
    - "Accept" button (`btn btn-primary` small): calls `onAccept(hail)`
    - "Ignore" button (`btn btn-secondary` small): calls `onDismiss(hail.npc_id)`
  - Auto-dismiss after 15 seconds (with fade-out animation)
  - If voice enabled and audio in hail, auto-play greeting audio
- [ ] Styling:
  - `card` class with border accent matching NPC type color
  - Backdrop blur
  - Subtle glow effect matching NPC type color

## Task 7.6: Wire Chat Panel into App

**File**: `client/src/App.jsx` (MODIFY)

- [ ] Import `useSocket` hook
- [ ] Import `useNPCEvents` hook
- [ ] Import `NPCHailNotification` and `NPCChatPanel`
- [ ] Add socket connection at app level:
  ```javascript
  const { socket, connected, joinSector, changeSector } = useSocket();
  const { pendingHails, combatAlert, dismissHail } = useNPCEvents(socket);
  const [activeChatNPC, setActiveChatNPC] = useState(null);
  ```
- [ ] Pass socket-related props through Layout to child components
- [ ] Render NPCHailNotification at top level (always visible):
  ```jsx
  <NPCHailNotification
    hails={pendingHails}
    onAccept={(hail) => { setActiveChatNPC(hail); dismissHail(hail.npc_id); }}
    onDismiss={(npcId) => dismissHail(npcId)}
  />
  ```
- [ ] Render NPCChatPanel when activeChatNPC is set:
  ```jsx
  {activeChatNPC && (
    <NPCChatPanel
      npc={activeChatNPC}
      user={user}
      socket={socket}
      onClose={() => setActiveChatNPC(null)}
    />
  )}
  ```

## Task 7.7: Add NPC Interaction Trigger to Game Views

**File**: `client/src/components/navigation/ui/SystemInfoPanel.jsx` (MODIFY) — or equivalent sector/system view

- [ ] When displaying NPCs in the current sector, add "Hail" button for interactive types (TRADER, PATROL, BOUNTY_HUNTER)
- [ ] "Hail" button: opens NPCChatPanel for that NPC
- [ ] "Engage" button for hostile types (PIRATE, PIRATE_LORD): triggers combat (existing flow)
- [ ] Use NPCPortrait component for NPC icons in the list

## Task 7.8: Phase 7 Verification

- [ ] Start server with at least one AI provider configured
- [ ] Log in as a player, navigate to a sector with NPC traders
- [ ] **Hail notification**:
  - [ ] Wait for NPC tick to potentially hail player (or trigger manually)
  - [ ] Verify notification slides in with NPC name and greeting
  - [ ] Click Accept — chat panel opens
  - [ ] Click Ignore on another — notification dismisses
- [ ] **Chat panel — menu interaction**:
  - [ ] See NPC greeting message
  - [ ] See menu buttons (Buy, Sell, Ask Rumors, etc.)
  - [ ] Click "Ask Rumors" — get scripted response
  - [ ] Click "Ask Prices" — get formatted price list
  - [ ] Verify responses have personality flavor
- [ ] **Chat panel — free text**:
  - [ ] Type "Where can I find cheap fuel?" — get AI response (or scripted fallback)
  - [ ] Verify "NPC is thinking..." indicator shows during AI call
  - [ ] Type same question again — verify faster response (cached)
- [ ] **Chat panel — voice** (if STT/TTS configured):
  - [ ] Click and hold mic button — verify recording indicator
  - [ ] Release — verify audio sent, transcription shown, NPC responds
  - [ ] Verify NPC response audio plays automatically
  - [ ] Disable voice in admin panel — verify mic button grayed out, text still works
- [ ] **Chat panel — close**:
  - [ ] Click Farewell — get farewell message, panel closes
  - [ ] Click X — panel closes immediately
- [ ] **Responsive**: test on narrow viewport, verify panel goes full-width
- [ ] Run `npm test` — existing tests pass
