# Agent11 Hackathon Build Plan

## Goal

Build Agent11 into a single-screen, high-impact second-screen sports experience for a scripted 6-over cricket thriller.

The product should feel like a live fan cockpit: users pick a side, predict every ball, watch pressure rise, see fan avatars react, and get AI-powered crowd pulse and commentary after key moments.

## Winning Positioning

Agent11 turns live sports from passive viewing into real-time fan participation.

Every match moment becomes something fans can predict, vote on, react to, and share, while AI agents explain the match and summarize crowd sentiment.

## Core Demo Loop

1. User chooses a side.
2. Next ball prediction appears.
3. Heartbeat countdown starts.
4. Ball outcome is revealed.
5. Score and pressure update.
6. Team avatars react.
7. User earns points or loses streak.
8. Crowd pulse and fan poll update.
9. AI commentary reacts to the moment.
10. Next ball begins.

This loop must feel alive every 5-8 seconds in fast demo mode.

## Product Modes

### Demo Match Mode

Primary hackathon mode.

- Scripted 6-over thriller.
- Predictable, cinematic match arc.
- No dependency on live APIs.
- Clearly disclosed as mock/scripted data.
- Designed for judging reliability and wow factor.

### Live API Mode

Secondary credibility mode.

- Settings allow users to configure Cricbuzz/RapidAPI credentials.
- Existing live provider work can remain available.
- UI should communicate that live mode is configurable.

## Demo Disclaimer

Use a compact badge in the War Room:

> Demo Match: scripted 6-over thriller. Add a Cricbuzz/RapidAPI key in Settings for live match feeds.

Use the full explanation in Settings.

## Target Screen

Keep the existing War Room layout, but change its purpose from passive dashboard to active fan arena.

### Top

- Agent11 brand.
- Match: RR vs DC or custom demo teams.
- Demo/Live badge.
- Settings button.
- Score, overs, equation, pressure status.

### Left Column

Purpose: match reality.

- Score.
- Batting/bowling team.
- Batter and bowler.
- Current over ball strip.
- Your selected side.
- Compact match disclaimer.

### Center Column

Purpose: main action.

- Team fan avatars on both sides.
- Prediction card in the middle.
- Countdown.
- Big ball reveal.
- Akash and Alia commentary below the action.

This should become the most important area of the app.

### Right Column

Purpose: emotion and participation.

- Pressure meter.
- Crowd pulse.
- User points and streak.
- Moment-triggered poll.
- Strategy/crowd AI summary.

### Bottom Area

Purpose: secondary context.

- Condensed scorecard.
- Momentum timeline.
- Compact agent activity.

Avoid empty waiting panels in demo mode.

## Phase 1: Demo Match Engine

Objective: make the app run a controlled 6-over thriller without live API dependency.

Tasks:

- Add a scripted 36-ball chase.
- Add match state progression.
- Add fast/normal demo timing.
- Add pause, next ball, and restart controls.
- Preserve existing live API code path.
- Add mode flag: demo vs live.

Match recommendation:

- Chase format.
- Start: need 49 from 36.
- Final over: need 11 from 6.
- Final ball: boundary to win.

Final over script:

- 5.1: wicket.
- 5.2: dot.
- 5.3: six.
- 5.4: one.
- 5.5: two.
- 5.6: four.

Acceptance criteria:

- Demo match runs end-to-end.
- No real API needed for demo.
- Score, overs, wickets, and equation update correctly.
- Final over feels dramatic.

## Phase 2: Prediction System

Objective: make the user participate before every ball.

Prediction options:

- Dot.
- 1-2 runs.
- Boundary.
- Wicket.

Scoring:

- Correct dot: +10.
- Correct 1-2 runs: +10.
- Correct boundary: +15.
- Correct wicket: +25.
- Streak bonus: +5 per consecutive correct prediction.

Acceptance criteria:

- Prediction is required or encouraged before each ball reveal.
- Points update immediately after reveal.
- Streak is visible.
- The user understands what to do within 2 seconds.

## Phase 3: Pressure System

Objective: make the chase feel tense.

Pressure meter range:

- 0-35: Calm.
- 36-60: Building.
- 61-80: Tense.
- 81-94: Red Zone.
- 95-100: Last-Ball Chaos.

Pressure rises on:

- Dot balls.
- Wickets.
- Required runs greater than balls left.
- New batter in final overs.
- User wrong prediction in pressure moments.

Pressure falls on:

- Boundaries.
- Sixes.
- Correct prediction.
- Fan poll confidence for batting side.

Acceptance criteria:

- Pressure visibly changes after each ball.
- Final over reaches Red Zone or Last-Ball Chaos.
- Pressure label is obvious and emotionally readable.

## Phase 4: Fan Side Selection And Avatar Duel

Objective: make the experience personal and emotional.

Flow:

- User chooses a side before entering the War Room.
- The chosen side is shown persistently.
- Two team avatars appear in the center action zone.

Avatar states:

- idle.
- cheer.
- dance.
- tease.
- nervous.
- facepalm.
- stunned.
- victory.

Event mapping:

- Four/six: batting avatar celebrates, bowling avatar reacts.
- Wicket: bowling avatar celebrates, batting avatar is stunned.
- Dot in final over: bowling avatar smirks, batting avatar gets nervous.
- Final-ball win: winning avatar celebrates, losing avatar stunned.

Acceptance criteria:

- User can pick a side.
- Avatars react on every key moment.
- Reactions are playful, not mean or distracting.
- Screen stays clean on desktop and mobile.

## Phase 5: Crowd Pulse And Moment Polls

Objective: show real-time fan participation beyond prediction.

Moment-triggered polls:

- After six: "Was that the momentum shift?"
- After wicket: "What should the batting side do now?"
- Death over: "Who wins from here?"
- Final ball: "What is your call?"

Crowd pulse metrics:

- Fan belief by team.
- Noise level.
- Anxiety.
- Momentum.

Acceptance criteria:

- Polls appear only on meaningful moments.
- Results feel live, even when mocked.
- Crowd pulse changes after votes and match events.

## Phase 6: AI Reaction Layer

Objective: make AI amplify the fan experience, not replace it.

Agent roles:

- Akash: emotional live commentary.
- Alia: tactical explanation.
- Strategy Agent: next-ball recommendation.
- Sentiment Agent: crowd pulse summary.

Crowd summary examples:

- "68% of fans still back RR, but the pressure meter is deep in red after that dot ball."
- "The crowd flipped after that six. Strategy Agent expects pace-off next ball."

Acceptance criteria:

- AI commentary reacts after ball reveals.
- Crowd pulse is mentioned in at least one agent output.
- No long paragraphs.
- Commentary feels broadcast-ready.

## Phase 7: Settings And Live API Story

Objective: make demo mode honest and live mode credible.

Settings should include:

- Demo Match / Live API mode.
- Cricket provider.
- API key input.
- Match ID input.
- Poll interval.
- Commentary language.
- TTS toggle.
- Full demo disclaimer.

Acceptance criteria:

- Settings are available without leaving the main experience.
- Demo mode disclaimer is clear.
- Live API path is discoverable.

## Phase 8: UI/UX Polish

Objective: make the app feel premium and judge-ready.

UX principles:

- One screen for the core experience.
- No dead panels during demo.
- Every state tells the user what to do next.
- Big moments should feel big.
- Keep copy short.
- Keep controls obvious.

Visual priorities:

- Strong score typography.
- Clean pressure meter.
- Smooth ball reveal animation.
- Avatar reactions.
- Clear selected-side treatment.
- Compact, readable panels.
- Responsive layout.

Acceptance criteria:

- First-time user understands the screen quickly.
- The demo can be presented in under 2 minutes.
- Desktop layout looks polished at 1366px and 1920px widths.
- Mobile layout remains usable.

## Phase 9: Demo Script

Objective: prepare a reliable judge presentation.

90-second pitch flow:

1. "Most sports second screens are passive."
2. "Agent11 turns every ball into a live fan interaction."
3. Choose side.
4. Predict next ball.
5. Reveal wicket or six.
6. Show avatar reactions.
7. Show pressure and crowd pulse shift.
8. Show AI commentary reacting to both match and fans.
9. Jump to final over.
10. Last-ball boundary win.

Acceptance criteria:

- Demo has a fast mode.
- Presenter can jump or restart cleanly.
- Final over is reliable.
- No internet/API dependency for the main demo.

## Build Order

1. Demo match engine.
2. Prediction system.
3. Pressure meter.
4. Single-screen UI integration.
5. Side selection and avatars.
6. Crowd pulse and polls.
7. AI reaction tuning.
8. Settings modal.
9. Responsive polish and demo controls.

## Non-Goals For Hackathon

- User authentication.
- Database persistence.
- Real multiplayer rooms.
- Complex fantasy sports rules.
- Multi-sport abstraction.
- Payment or monetization.
- Perfect live score accuracy.

## Success Definition

The judge should feel that Agent11 is not just displaying a match.

It should feel like the match is happening with them:

- They picked a side.
- They made predictions.
- Their points changed.
- The crowd reacted.
- The avatars celebrated or panicked.
- AI explained why the moment mattered.
- The final over felt tense.

