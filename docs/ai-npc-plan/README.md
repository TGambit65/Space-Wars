# AI-Augmented NPC System — Implementation Plan

## Overview

Adds AI-driven NPC behavior, interactive dialogue with voice, WebSocket real-time events, and a full admin panel to Space Wars 3000.

**Core principles**:
- Text-first, voice-optional — every NPC output is always text, TTS augments it
- Scripting handles 70-80% of decisions — AI only for ambiguous/complex situations
- Provider-agnostic — swap between Anthropic, OpenAI, Gemini, Grok, OpenRouter, or local models
- API-first development — use cloud APIs for testing, self-host for production

## Phase Documents

| Phase | Document | Goal | Dependencies |
|-------|----------|------|-------------|
| 1 | [phase-1-foundation.md](phase-1-foundation.md) | GameSettings model + AI provider abstraction (LLM, STT, TTS) | None |
| 2 | [phase-2-behavior-trees.md](phase-2-behavior-trees.md) | NPC model extensions + tactical behavior tree engine | Phase 1 |
| 3 | [phase-3-dialogue.md](phase-3-dialogue.md) | Menu-driven dialogue + AI free-text + voice service | Phase 2 |
| 4 | [phase-4-game-tick.md](phase-4-game-tick.md) | Background game loop for NPC processing | Phase 2 |
| 5 | [phase-5-websocket.md](phase-5-websocket.md) | Socket.io real-time events + audio streaming | Phase 4 |
| 6 | [phase-6-admin-panel.md](phase-6-admin-panel.md) | Full admin UI for AI config + NPC management | Phase 1 |
| 7 | [phase-7-chat-ui.md](phase-7-chat-ui.md) | Player-facing NPC chat panel + voice UI | Phase 3 + 5 |

## Dependency Graph

```
Phase 1 (Foundation)
  ├── Phase 2 (Behavior Trees + NPC Model)
  │     ├── Phase 3 (Dialogue System)
  │     └── Phase 4 (Tick System)
  │           └── Phase 5 (WebSocket)
  ├── Phase 6 (Admin UI) ← parallel with 2-5
  └── Phase 7 (Chat UI + Voice) ← needs 3 + 5
```

## File Counts

- New server files: ~34
- New client files: ~9
- Modified files: ~15
- New npm dependencies: socket.io, socket.io-client, multer

## Hardware Targets

- **Development**: Cloud APIs (DeepSeek, Haiku, OpenAI) — no GPU needed
- **Production**: Dual Tesla P40 (48GB) — 8B tactical + 32B interactive + Whisper + Piper TTS
- **Alternative**: Single RTX 3090 (24GB) — 8B tactical + 14B interactive
