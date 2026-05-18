# DugoutAi Cricket War Room

Local-first multi-agent cricket intelligence app using React, Node.js, Google ADK, Gemini, and a live cricket API.

## Run Locally

From the root folder:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Backend health:

```text
http://localhost:4200/health
```

## Deploy To Google Cloud Run

This repo includes a Dockerfile and a Cloud Run deployment guide:

```text
DEPLOY_GCP.md
```

For a first deployment, use demo mode on Cloud Run, then add live cricket/TTS credentials after the service is working.

## Required Environment

Create `.env` from `.env.example` and set:

```text
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-flash-latest
CRICKET_API_KEY=your_cricketdata_or_cricapi_key
CRICKET_MATCH_ID=
CRICKET_POLL_MS=15000
```

`CRICKET_MATCH_ID` is optional. If omitted, the server selects the first live scored match returned by the cricket API.

## Zero Fake Cricket Data Policy

The app does not generate match scores, teams, wickets, overs, or ball movement locally.

Live cricket state comes from:

```text
https://api.cricapi.com/v1/currentMatches
```

The backend only emits a new match event when the live API score, wickets, or overs change.

If no live scored match is returned, the UI shows a waiting state instead of fabricated data.

## Where The Agents Are

The agent system is intentionally visible and modular:

```text
packages/agents/src/registry.ts
```

This file defines the named Google ADK agents:

- `Hype Commentary Agent`
- `Analyst Commentary Agent`
- `Prediction Agent`
- `Strategy Agent`
- `Sentiment Agent`

Each agent has:

- an `id`
- a display label
- trigger rules
- whether it can speak
- its Gemini/ADK prompt
- unavailable-state text

The parallel execution logic is here:

```text
packages/agents/src/orchestrator.ts
```

The ADK runner wrapper is here:

```text
packages/agents/src/adkRunner.ts
```

## System Flow

```text
Live Cricket API
        ↓
Live Feed Adapter
        ↓
Match Context Normalizer
        ↓
Event Detector
        ↓
Agent Orchestrator
        ↓
Parallel Google ADK Agents
        ↓
Socket.IO Backend
        ↓
Animated React War Room
```

## Important Files

```text
packages/cricket/src/liveCricketApi.ts  live cricket API adapter
packages/cricket/src/eventDetector.ts   moment detection
packages/agents/src/registry.ts         agent definitions and prompts
packages/agents/src/orchestrator.ts     parallel agent execution
apps/server/src/server.ts               local realtime backend
apps/web/src/main.tsx                   animated dashboard
apps/web/src/styles.css                 visual system and animations
```
