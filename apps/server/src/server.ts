import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Server } from "socket.io";
import { AgentOrchestrator } from "@agent11/agents";
import { DemoSixOverThriller, detectMoment, FreeRapidApiCricbuzz, LiveCricketApi, RapidApiCricbuzz } from "@agent11/cricket";
import { isTtsEnabled, synthesizeCommentary } from "./tts.js";
import type {
  AgentActivity,
  AgentOutput,
  ClientToServerEvents,
  DashboardSnapshot,
  DetectedMoment,
  MatchSummary,
  MatchState,
  ServerToClientEvents
} from "@agent11/shared";
import type { LiveFeedResult } from "@agent11/cricket";

function loadRootEnv() {
  let directory = process.cwd();

  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = path.join(directory, ".env");
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return candidate;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }

  dotenv.config();
  return null;
}

const envPath = loadRootEnv();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || process.env.SERVER_PORT || 4200);
const webDistPath = path.resolve(__dirname, "../../web/dist");

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"]
  }
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
      : undefined
  })
);
app.use(express.json());

let matchState: MatchState | null = null;
let moments: DetectedMoment[] = [];
let outputs: AgentOutput[] = [];
let activities: AgentActivity[] = [];
let running = true;
let fanMeterHold = false;
let lastFeedAdvanceAt = 0;
let ballAudioHoldUntil = 0;
let timer: NodeJS.Timeout | undefined;
let fanMeterResumeTimer: NodeJS.Timeout | undefined;
let feedStatus = "Waiting for live cricket API.";
const initialProvider = process.env.CRICKET_PROVIDER || "demo";
const liveProvider = initialProvider === "demo" ? process.env.CRICKET_LIVE_PROVIDER || "free_rapidapi_cricbuzz" : initialProvider;
const pollMs = Number(process.env.CRICKET_POLL_MS || 15000);
const secondInningsWaitMs = Number(process.env.SECOND_INNINGS_WAIT_MS || 7000);
const boundaryAudioWaitMs = Number(process.env.BOUNDARY_AUDIO_WAIT_MS || 11000);
const matchFilter = process.env.CRICKET_MATCH_FILTER === "all" ? "all" : "ipl";
const useCricbuzzCommentary = process.env.CRICBUZZ_USE_COMMENTARY === "true";

interface CricketFeed {
  setMatchId(matchId: string | undefined): void;
  getSelectedMatchId(): string | null;
  listIplMatches(): Promise<{ matches: MatchSummary[]; status: string }>;
  poll(): Promise<LiveFeedResult>;
  jumpToFinalOver?: () => void;
}

const demoFeed = new DemoSixOverThriller();

function createLiveFeed(provider: string): CricketFeed {
  return provider === "rapidapi_cricbuzz"
    ? new RapidApiCricbuzz(process.env.RAPIDAPI_KEY, process.env.RAPIDAPI_HOST, process.env.CRICKET_MATCH_ID, matchFilter, useCricbuzzCommentary)
    : provider === "free_rapidapi_cricbuzz"
      ? new FreeRapidApiCricbuzz(
          process.env.RAPIDAPI_KEY,
          process.env.RAPIDAPI_HOST,
          process.env.CRICKET_MATCH_ID,
          matchFilter,
          process.env.FREE_CRICBUZZ_FIXTURES_PATH,
          process.env.FREE_CRICBUZZ_LIVE_SCORE_PATH,
          process.env.FREE_CRICBUZZ_MATCH_INFO_PATH,
          process.env.IPL_FEATURED_MATCH_URLS,
          process.env.CRICBUZZ_FEATURED_MATCH_URLS
        )
      : new LiveCricketApi(process.env.CRICKET_API_KEY, process.env.CRICKET_MATCH_ID, matchFilter);
}

const liveFeed = createLiveFeed(liveProvider);
let activeFeed: CricketFeed = initialProvider === "demo" ? demoFeed : liveFeed;
let activeSource: DashboardSnapshot["source"] = initialProvider === "demo" ? "demo" : "live";

function isDemoMatchId(matchId: string) {
  return matchId.startsWith("demo-");
}

function isSuperOverDemo() {
  return activeFeed.getSelectedMatchId()?.includes("super-over") ?? false;
}

function isSuperOverFanMeterCheckpoint(result: LiveFeedResult) {
  return activeSource === "demo" && isSuperOverDemo() && Boolean(result.state) && !result.event && result.status.includes("Fan meter opens");
}

function autoPollIntervalMs() {
  if (activeSource === "demo") {
    return isSuperOverDemo() ? 15000 : 12000;
  }
  return pollMs;
}

function selectFeedForMatch(matchId: string) {
  activeSource = isDemoMatchId(matchId) ? "demo" : "live";
  activeFeed = activeSource === "demo" ? demoFeed : liveFeed;
  activeFeed.setMatchId(matchId);
}

const orchestrator = new AgentOrchestrator({
  onActivity: (activity) => {
    activities = upsertActivity(activity, activities);
    io.emit("agentActivity", activity);
  },
  onOutput: (output) => {
    void publishOutput(output);
  }
});

async function publishOutput(output: AgentOutput) {
  let enriched = output;
  if (output.speak && isTtsEnabled()) {
    try {
      const audio = await synthesizeCommentary(output);
      if (audio) {
        enriched = { ...output, audio };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Google TTS synthesis failed.";
      activities = upsertActivity(
        {
          agentId: "voice",
          label: "Voice Agent",
          status: "error",
          detail,
          updatedAt: Date.now()
        },
        activities
      );
      io.emit("agentActivity", activities[0]);
    }
  }

  outputs = [enriched, ...outputs].slice(0, 40);
  io.emit("agentOutput", enriched);
}

function upsertActivity(activity: AgentActivity, existing: AgentActivity[]) {
  return [activity, ...existing.filter((item) => item.agentId !== activity.agentId)].slice(0, 12);
}

function snapshot(): DashboardSnapshot {
  return {
    matchState,
    moments,
    outputs,
    activities,
    running,
    source: activeSource,
    feedStatus,
    selectedMatchId: activeFeed.getSelectedMatchId(),
    matchFilter
  };
}

function clearSession() {
  matchState = null;
  moments = [];
  outputs = [];
  activities = [];
  fanMeterHold = false;
  if (fanMeterResumeTimer) {
    clearTimeout(fanMeterResumeTimer);
    fanMeterResumeTimer = undefined;
  }
  ballAudioHoldUntil = 0;
  lastFeedAdvanceAt = 0;
}

function isSecondInningsBreakPending() {
  return Boolean(fanMeterResumeTimer);
}

function isBallAudioHoldPending() {
  return Date.now() < ballAudioHoldUntil;
}

function applyBallAudioHold(event: LiveFeedResult["event"]) {
  if (!event || (event.outcome !== "four" && event.outcome !== "six")) {
    return;
  }

  ballAudioHoldUntil = Date.now() + boundaryAudioWaitMs;
}

function beginSecondInningsBreak() {
  if (fanMeterResumeTimer) {
    return;
  }

  fanMeterHold = false;
  running = false;
  feedStatus = `Fan meter result locked. Second innings starts in ${Math.round(secondInningsWaitMs / 1000)} seconds.`;
  io.emit("snapshot", snapshot());

  fanMeterResumeTimer = setTimeout(() => {
    fanMeterResumeTimer = undefined;
    running = true;
    feedStatus = "Second innings starting. Watch the chase begin.";
    io.emit("snapshot", snapshot());
    void forceNextBall();
  }, secondInningsWaitMs);
}

async function pollLiveFeed(trigger: "auto" | "manual" = "manual") {
  if (!running) {
    return;
  }

  const now = Date.now();
  if (now < ballAudioHoldUntil) {
    return;
  }

  if (trigger === "auto" && now - lastFeedAdvanceAt < autoPollIntervalMs()) {
    return;
  }

  const result = await activeFeed.poll();
  lastFeedAdvanceAt = now;
  feedStatus = result.status;
  matchState = result.state;
  const event = result.event;

  if (!matchState || !event) {
    if (isSuperOverFanMeterCheckpoint(result)) {
      fanMeterHold = true;
      running = false;
    }
    io.emit("snapshot", snapshot());
    return;
  }

  const moment = detectMoment(matchState, event);
  moments = [moment, ...moments].slice(0, 12);
  applyBallAudioHold(event);

  io.emit("ball", event);
  io.emit("moment", moment);
  io.emit("snapshot", snapshot());

  await orchestrator.run({ matchState, moment });
  io.emit("snapshot", snapshot());
}

async function forceNextBall() {
  const wasRunning = running;
  running = true;
  await pollLiveFeed("manual");
  running = wasRunning;
}

function geminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function compactMatchContext() {
  return {
    source: activeSource,
    feedStatus,
    selectedMatchId: activeFeed.getSelectedMatchId(),
    matchState,
    latestMoments: moments.slice(0, 5),
    latestAgentOutputs: outputs.slice(0, 8).map((output) => ({
      label: output.label,
      text: output.text,
      confidence: output.confidence,
      createdAt: output.createdAt
    }))
  };
}

async function answerMatchQuestion(question: string) {
  const key = geminiApiKey();
  if (!key) {
    throw new Error("Gemini API key is not configured.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;
  const prompt = [
    "You are DugoutAi's match assistant.",
    "Answer only cricket-match-related questions using the supplied match context.",
    "If the answer is not available in the context, say what is missing and suggest the closest useful match insight.",
    "Keep the answer concise, practical, and fan-friendly. Use Hinglish only when the question uses Hinglish; otherwise use English.",
    "",
    `Question: ${question}`,
    "",
    `Match context JSON:\n${JSON.stringify(compactMatchContext(), null, 2)}`
  ].join("\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 280
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini answer request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  return answer || "Gemini did not return an answer for this match question.";
}

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    geminiConfigured: Boolean(geminiApiKey()),
    commentaryLanguage: process.env.COMMENTARY_LANGUAGE || "hinglish",
    cricketProvider: initialProvider,
    liveProvider,
    activeSource,
    matchFilter,
    cricketApiConfigured: Boolean(process.env.CRICKET_API_KEY),
    rapidApiConfigured: Boolean(process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_HOST),
    cricbuzzCommentaryEnabled: useCricbuzzCommentary,
    freeCricbuzzPaths: {
      fixtures: process.env.FREE_CRICBUZZ_FIXTURES_PATH || null,
      liveScore: process.env.FREE_CRICBUZZ_LIVE_SCORE_PATH || null,
      matchInfo: process.env.FREE_CRICBUZZ_MATCH_INFO_PATH || null,
      featuredIplUrls: process.env.IPL_FEATURED_MATCH_URLS ? "configured" : null,
      featuredCricbuzzUrls: process.env.CRICBUZZ_FEATURED_MATCH_URLS ? "configured" : null
    },
    cricketMatchId: process.env.CRICKET_MATCH_ID || null,
    pollMs,
    secondInningsWaitMs,
    boundaryAudioWaitMs,
    envPath,
    ttsEnabled: isTtsEnabled()
  });
});

app.get("/snapshot", (_request, response) => {
  response.json(snapshot());
});

app.post("/ask-gemini", async (request, response) => {
  const question = typeof request.body?.question === "string" ? request.body.question.trim() : "";
  if (!question) {
    response.status(400).json({ ok: false, error: "question is required" });
    return;
  }
  if (question.length > 500) {
    response.status(400).json({ ok: false, error: "question must be 500 characters or fewer" });
    return;
  }

  try {
    const answer = await answerMatchQuestion(question);
    response.json({ ok: true, answer, source: activeSource, selectedMatchId: activeFeed.getSelectedMatchId() });
  } catch (error) {
    response.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Gemini answer request failed."
    });
  }
});

app.get("/matches/ipl", async (_request, response) => {
  const [demoResult, liveResult] = await Promise.all([demoFeed.listIplMatches(), liveFeed.listIplMatches()]);
  const demoIds = new Set(demoResult.matches.map((match) => match.id));
  response.json({
    matches: [...demoResult.matches, ...liveResult.matches.filter((match) => !demoIds.has(match.id))],
    status: `${demoResult.status} Live mode: ${liveResult.status}`
  });
});

app.post("/matches/select", (request, response) => {
  const matchId = typeof request.body?.matchId === "string" ? request.body.matchId : "";
  if (!matchId) {
    response.status(400).json({ ok: false, error: "matchId is required" });
    return;
  }

  selectFeedForMatch(matchId);
  clearSession();
  feedStatus = activeSource === "demo" ? "Demo match selected. Make your first prediction." : "Selected IPL match. Waiting for live score feed.";
  running = true;
  io.emit("snapshot", snapshot());
  void pollLiveFeed("manual");
  response.json({ ok: true, selectedMatchId: matchId, source: activeSource });
});

if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(webDistPath, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.emit("snapshot", snapshot());

  socket.on("replay", () => {
    activeFeed.setMatchId(activeFeed.getSelectedMatchId() ?? undefined);
    clearSession();
    running = true;
    io.emit("snapshot", snapshot());
    void pollLiveFeed("manual");
  });

  socket.on("pause", () => {
    running = false;
    io.emit("snapshot", snapshot());
  });

  socket.on("resume", () => {
    if (fanMeterHold || isSecondInningsBreakPending() || isBallAudioHoldPending()) {
      io.emit("snapshot", snapshot());
      return;
    }
    running = true;
    io.emit("snapshot", snapshot());
  });

  socket.on("nextBall", () => {
    if (fanMeterHold || isSecondInningsBreakPending() || isBallAudioHoldPending()) {
      io.emit("snapshot", snapshot());
      return;
    }
    void forceNextBall();
  });

  socket.on("fanMeterComplete", () => {
    if (!fanMeterHold || activeSource !== "demo" || !isSuperOverDemo()) {
      return;
    }
    beginSecondInningsBreak();
  });

  socket.on("jumpFinalOver", () => {
    if (activeSource !== "demo" || !activeFeed.jumpToFinalOver) {
      return;
    }
    activeFeed.jumpToFinalOver();
    clearSession();
    feedStatus = activeFeed.getSelectedMatchId()?.includes("super-over")
      ? "Jumped to CSK chase in the Super Over. CSK need 19."
      : "Jumped to the final over. RCB need 11 from 6.";
    running = false;
    io.emit("snapshot", snapshot());
    void forceNextBall();
  });

  socket.on("selectMatch", (matchId) => {
    if (!matchId) {
      return;
    }
    selectFeedForMatch(matchId);
    clearSession();
    feedStatus = activeSource === "demo" ? "Demo match selected. Make your first prediction." : "Selected IPL match. Waiting for live score feed.";
    running = true;
    io.emit("snapshot", snapshot());
    void pollLiveFeed("manual");
  });
});

server.listen(port, () => {
  void pollLiveFeed("manual");
  timer = setInterval(() => {
    void pollLiveFeed("auto");
  }, 1000);

  console.log(`DugoutAi server running on http://localhost:${port}`);
});

process.on("SIGINT", () => {
  if (timer) {
    clearInterval(timer);
  }
  server.close();
});
