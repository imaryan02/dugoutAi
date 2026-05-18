import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Brain,
  ChartNoAxesCombined,
  Expand,
  Gauge,
  Home,
  Mic2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Zap
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import type { AgentActivity, AgentOutput, BallEvent, DashboardSnapshot, MatchState, MatchSummary } from "@agent11/shared";
import { stadiumAudio } from "./stadiumAudio";
import "./styles.css";

const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin || "http://localhost:4200";
const socket = io(serverUrl);

const outcomeLabel: Record<string, string> = {
  dot: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  six: "6",
  wicket: "W",
  wide: "Wd",
  noBall: "Nb"
};

type PredictionChoice = "dot" | "oneTwo" | "boundary" | "wicket";
type DugoutScene = "welcome" | "pressure" | "fanMeterIntro" | "cheerPrompt" | "listening" | "battleResult" | "matchStart" | "prediction" | "replay";
type CheerPhase = "batting" | "bowling";

type FanBattleSnapshot = {
  battingTeam: string;
  bowlingTeam: string;
  battingScore: number;
  bowlingScore: number;
  winner: string;
  phase: DugoutScene;
  updatedAt: number;
};

const fanBattleWinnerHistory = {
  next: "batting" as "batting" | "bowling"
};

type HealthStatus = {
  ok: boolean;
  geminiConfigured: boolean;
  commentaryLanguage: string;
  cricketProvider: string;
  liveProvider: string;
  activeSource: "demo" | "live";
  matchFilter: string;
  cricketApiConfigured: boolean;
  rapidApiConfigured: boolean;
  cricbuzzCommentaryEnabled: boolean;
  freeCricbuzzPaths: {
    fixtures: string | null;
    liveScore: string | null;
    matchInfo: string | null;
    featuredIplUrls: string | null;
    featuredCricbuzzUrls: string | null;
  };
  cricketMatchId: string | null;
  pollMs: number;
  envPath: string;
  ttsEnabled: boolean;
};

const predictionLabels: Record<PredictionChoice, string> = {
  dot: "Dot",
  oneTwo: "1-2 runs",
  boundary: "Boundary",
  wicket: "Wicket"
};

function classifyOutcome(ball: BallEvent): PredictionChoice {
  if (ball.outcome === "wicket") {
    return "wicket";
  }
  if (ball.outcome === "four" || ball.outcome === "six") {
    return "boundary";
  }
  if (ball.outcome === "one" || ball.outcome === "two" || ball.outcome === "three" || ball.outcome === "wide" || ball.outcome === "noBall") {
    return "oneTwo";
  }
  return "dot";
}

function predictionPoints(choice: PredictionChoice, streak: number) {
  const base = choice === "wicket" ? 25 : choice === "boundary" ? 15 : 10;
  return base + streak * 5;
}

function ballNumber(matchState: MatchState) {
  const latest = matchState.lastEvent ?? matchState.recentBalls[matchState.recentBalls.length - 1];
  if (!latest) {
    return "0.1";
  }
  if (latest.ball >= 6) {
    return `${latest.over + 1}.1`;
  }
  return `${latest.over}.${latest.ball + 1}`;
}

function legalBallsFromOvers(overs: string) {
  const [wholeRaw, ballRaw] = overs.split(".");
  return Number(wholeRaw || 0) * 6 + Number(ballRaw || 0);
}

function pressureValue(matchState: MatchState) {
  if (matchState.target <= 0) {
    return Math.max(20, Math.min(80, Math.round(100 - matchState.momentum)));
  }

  const balls = legalBallsFromOvers(matchState.overs);
  const ballsLeft = Math.max(0, 36 - balls);
  const runsNeeded = matchState.target > 0 ? Math.max(0, matchState.target - matchState.score) : 0;
  const equationLoad = ballsLeft ? Math.min(34, Math.max(0, runsNeeded - ballsLeft) * 3) : 0;
  const eventLoad = matchState.lastEvent?.outcome === "wicket" ? 18 : matchState.lastEvent?.outcome === "dot" ? 10 : matchState.lastEvent?.outcome === "six" ? -14 : matchState.lastEvent?.outcome === "four" ? -9 : 0;
  const phaseLoad = balls >= 30 ? 24 : balls >= 24 ? 14 : 5;
  const clutchLoad = balls >= 30 && runsNeeded > ballsLeft ? 12 : 0;
  return Math.max(12, Math.min(99, 24 + equationLoad + phaseLoad + clutchLoad + matchState.wickets * 4 + eventLoad));
}

function pressureLabel(value: number) {
  if (value >= 95) return "Last-ball chaos";
  if (value >= 81) return "Red zone";
  if (value >= 61) return "Tense";
  if (value >= 36) return "Building";
  return "Calm";
}

function isGoodForBatting(ball: BallEvent | null) {
  return Boolean(ball && ["four", "six", "one", "two", "three", "wide", "noBall"].includes(ball.outcome));
}

function commentaryToneFromBall(ball: BallEvent | null) {
  if (!ball) return "normal";
  if (ball.outcome === "six") return "six";
  if (ball.outcome === "four") return "boundary";
  if (ball.outcome === "wicket") return "wicket";
  if (ball.outcome === "dot") return "dot";
  return "normal";
}

function commentaryToneFromText(text: string) {
  const lowered = text.toLowerCase();
  if (lowered.includes("six") || lowered.includes("chhakka") || lowered.includes("stands")) return "six";
  if (lowered.includes("wicket") || lowered.includes("bowled") || lowered.includes("jhatka")) return "wicket";
  if (lowered.includes("boundary") || lowered.includes("four")) return "boundary";
  if (lowered.includes("dot ball") || lowered.includes("dot")) return "dot";
  return "normal";
}

function groupBallsByOver(balls: BallEvent[]) {
  return balls.reduce<Array<{ over: number; balls: BallEvent[] }>>((groups, ball) => {
    const existing = groups.find((group) => group.over === ball.over);
    if (existing) {
      existing.balls.push(ball);
    } else {
      groups.push({ over: ball.over, balls: [ball] });
    }
    return groups;
  }, []);
}

function App() {
  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot | null>(null);
  const [latestBall, setLatestBall] = React.useState<BallEvent | null>(null);
  const [matches, setMatches] = React.useState<MatchSummary[]>([]);
  const [matchStatus, setMatchStatus] = React.useState("Loading IPL fixtures");
  const [connected, setConnected] = React.useState(socket.connected);
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const voiceEnabledRef = React.useRef(false);
  const audioQueueRef = React.useRef<AgentOutput[]>([]);
  const audioPlayingRef = React.useRef(false);
  const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const queuedAudioIdsRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  const playNextAudio = React.useCallback(() => {
    if (audioPlayingRef.current || !voiceEnabledRef.current) {
      return;
    }
    const next = audioQueueRef.current.shift();
    if (!next?.audio) {
      return;
    }
    queuedAudioIdsRef.current.add(next.id);
    audioPlayingRef.current = true;
    const audio = new Audio(`data:${next.audio.mimeType};base64,${next.audio.data}`);
    currentAudioRef.current = audio;
    audio.onended = () => {
      currentAudioRef.current = null;
      audioPlayingRef.current = false;
      playNextAudio();
    };
    audio.onerror = () => {
      currentAudioRef.current = null;
      audioPlayingRef.current = false;
      playNextAudio();
    };
    void audio.play().catch(() => {
      currentAudioRef.current = null;
      audioPlayingRef.current = false;
    });
  }, []);

  const enableVoice = React.useCallback(() => {
    setVoiceEnabled(true);
    window.setTimeout(playNextAudio, 0);
  }, [playNextAudio]);

  const stopVoice = React.useCallback(() => {
    setVoiceEnabled(false);
    voiceEnabledRef.current = false;
    audioQueueRef.current = [];
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current.src = "";
      currentAudioRef.current.load();
      currentAudioRef.current = null;
    }
    audioPlayingRef.current = false;
  }, []);

  const queueAudioOutput = React.useCallback((output: AgentOutput) => {
    if (!output.audio || queuedAudioIdsRef.current.has(output.id)) {
      return;
    }
    queuedAudioIdsRef.current.add(output.id);
    audioQueueRef.current.push(output);
    playNextAudio();
  }, [playNextAudio]);

  React.useEffect(() => {
    if (!voiceEnabled || !snapshot?.outputs.length) {
      return;
    }
    snapshot.outputs
      .filter((output) => output.audio)
      .slice()
      .reverse()
      .forEach(queueAudioOutput);
  }, [queueAudioOutput, snapshot?.outputs, voiceEnabled]);

  const loadMatches = React.useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/matches/ipl`);
      const payload = (await response.json()) as { matches: MatchSummary[]; status: string };
      setMatches(payload.matches);
      setMatchStatus(payload.status);
    } catch {
      setMatchStatus("Unable to load IPL matches from backend.");
    }
  }, []);

  React.useEffect(() => {
    void loadMatches();
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("snapshot", (payload) => {
      setSnapshot(payload);
      if (!payload.matchState?.lastEvent) {
        setLatestBall(null);
      }
    });
    socket.on("ball", setLatestBall);
    socket.on("agentOutput", (output: AgentOutput) => {
      queueAudioOutput(output);
      setSnapshot((current) =>
        current ? { ...current, outputs: [output, ...current.outputs.filter((item) => item.id !== output.id)].slice(0, 40) } : current
      );
    });
    socket.on("agentActivity", (activity) => {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              activities: [activity, ...current.activities.filter((item) => item.agentId !== activity.agentId)].slice(0, 12)
            }
          : current
      );
    });

    return () => {
      socket.removeAllListeners();
    };
  }, [queueAudioOutput]);

  return (
    <BrowserRouter>
      <AppShell connected={connected} snapshot={snapshot}>
        <Routes>
          <Route path="/" element={<Navigate to="/matches" replace />} />
          <Route
            path="/matches"
            element={
              snapshot ? (
                <MatchHub snapshot={snapshot} matches={matches} status={matchStatus} connected={connected} onRefresh={loadMatches} />
              ) : (
                <Loading connected={connected} />
              )
            }
          />
          <Route
            path="/room"
            element={
              snapshot ? (
                <WarRoom
                  snapshot={snapshot}
                  matches={matches}
                  latestBall={latestBall}
                  connected={connected}
                  voiceEnabled={voiceEnabled}
                  onEnableVoice={enableVoice}
                  onStopVoice={stopVoice}
                  onRefresh={loadMatches}
                />
              ) : (
                <Loading connected={connected} />
              )
            }
          />
          <Route path="/diagnostics" element={<Diagnostics snapshot={snapshot} connected={connected} matchStatus={matchStatus} />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

function AppShell({ children, connected, snapshot }: { children: React.ReactNode; connected: boolean; snapshot: DashboardSnapshot | null }) {
  return (
    <main className="app-shell">
      <div className="ambient-grid" />
      <nav className="navbar">
        <NavLink to="/matches" className="brand-link">
          <Brain size={24} />
          <span>DugoutAi</span>
        </NavLink>
        <div className="nav-links">
          <NavLink to="/matches">
            <Home size={17} />
            Matches
          </NavLink>
          <NavLink to="/room">
            <Gauge size={17} />
            War Room
          </NavLink>
          <NavLink to="/diagnostics">
            <Settings size={17} />
            Settings
          </NavLink>
        </div>
        <div className="nav-status">
          <span className={connected ? "live-dot" : "offline-dot"} />
        <span>{snapshot?.source === "demo" ? "Demo match" : snapshot?.matchFilter === "all" ? "All matches" : "IPL only"}</span>
        </div>
      </nav>
      {children}
    </main>
  );
}

function WarRoom({
  snapshot,
  matches,
  latestBall,
  connected,
  voiceEnabled,
  onEnableVoice,
  onStopVoice,
  onRefresh
}: {
  snapshot: DashboardSnapshot;
  matches: MatchSummary[];
  latestBall: BallEvent | null;
  connected: boolean;
  voiceEnabled: boolean;
  onEnableVoice: () => void;
  onStopVoice: () => void;
  onRefresh: () => void;
}) {
  const [selectedSide, setSelectedSide] = React.useState<string | null>(null);
  const [prediction, setPrediction] = React.useState<PredictionChoice | null>(null);
  const [fanScore, setFanScore] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [bestStreak, setBestStreak] = React.useState(0);
  const [totalPredictions, setTotalPredictions] = React.useState(0);
  const [correctPredictions, setCorrectPredictions] = React.useState(0);
  const [lastResult, setLastResult] = React.useState<{ correct: boolean; points: number; text: string } | null>(null);
  const [fanBattle, setFanBattle] = React.useState<FanBattleSnapshot | null>(null);
  const scoredBallIdsRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    setPrediction(null);
    setFanScore(0);
    setStreak(0);
    setBestStreak(0);
    setTotalPredictions(0);
    setCorrectPredictions(0);
    setLastResult(null);
    setFanBattle(null);
    scoredBallIdsRef.current.clear();
  }, [snapshot.selectedMatchId]);

  React.useEffect(() => {
    if (!latestBall || scoredBallIdsRef.current.has(latestBall.id) || !prediction) {
      return;
    }

    scoredBallIdsRef.current.add(latestBall.id);
    const actual = classifyOutcome(latestBall);
    const correct = actual === prediction;
    const points = correct ? predictionPoints(prediction, streak) : 0;
    setFanScore((current) => current + points);
    setStreak((current) => {
      const next = correct ? current + 1 : 0;
      setBestStreak((best) => Math.max(best, next));
      return next;
    });
    setTotalPredictions((current) => current + 1);
    setCorrectPredictions((current) => current + (correct ? 1 : 0));
    setLastResult({
      correct,
      points,
      text: correct ? `You called ${predictionLabels[prediction]}` : `Actual result: ${predictionLabels[actual]}`
    });
    setPrediction(null);
  }, [latestBall, prediction, streak]);

  if (!snapshot.selectedMatchId) {
    return <Navigate to="/matches" replace />;
  }

  if (!snapshot.matchState) {
    return <WaitingForLiveFeed snapshot={snapshot} matches={matches} connected={connected} onRefresh={onRefresh} />;
  }

  const matchState = snapshot.matchState;
  const selectedMatch = matches.find((match) => match.id === snapshot.selectedMatchId);
  const chartData = matchState.recentBalls.map((ball, index) => ({
    name: `${ball.over}.${ball.ball}`,
    momentum: Math.max(5, Math.min(95, matchState.momentum - (matchState.recentBalls.length - index) * 4 + ball.runs * 6))
  }));

  return (
    <>
      <TopBar snapshot={snapshot} matchState={matchState} selectedMatch={selectedMatch} connected={connected} />
      <PresenterControls snapshot={snapshot} matches={matches} />

      <section className="broadcast-grid">
        <ScoreDeck matchState={matchState} latestBall={latestBall} selectedMatch={selectedMatch} selectedSide={selectedSide} />
        <FanArena
          matchState={matchState}
          feedStatus={snapshot.feedStatus}
          outputs={snapshot.outputs}
          activities={snapshot.activities}
          latestBall={latestBall}
          prediction={prediction}
          selectedSide={selectedSide}
          lastResult={lastResult}
          fanScore={fanScore}
          streak={streak}
          bestStreak={bestStreak}
          totalPredictions={totalPredictions}
          correctPredictions={correctPredictions}
          onPredict={setPrediction}
          onSelectSide={setSelectedSide}
          fanBattle={fanBattle}
          onFanBattleUpdate={setFanBattle}
          voiceEnabled={voiceEnabled}
          onEnableVoice={onEnableVoice}
          onStopVoice={onStopVoice}
        />
        <InsightStack snapshot={snapshot} matchState={matchState} chartData={chartData} fanScore={fanScore} streak={streak} selectedSide={selectedSide} fanBattle={fanBattle} />
        <ScorecardPanel matchState={matchState} />
        <AgentMiniRail activities={snapshot.activities} />
        <StadiumFeelPanel matchState={matchState} latestBall={latestBall} selectedSide={selectedSide} />
        <BroadcastControls snapshot={snapshot} voiceEnabled={voiceEnabled} onEnableVoice={onEnableVoice} onStopVoice={onStopVoice} />
      </section>
    </>
  );
}

function PresenterControls({ snapshot, matches }: { snapshot: DashboardSnapshot; matches: MatchSummary[] }) {
  const [chooserOpen, setChooserOpen] = React.useState(false);
  const demoMatches = matches.filter((match) => match.id.startsWith("demo-"));
  const fanMeterHold = snapshot.selectedMatchId?.includes("super-over") && snapshot.feedStatus.includes("Fan meter opens");
  const switchDemo = (matchId: string) => {
    socket.emit("selectMatch", matchId);
    setChooserOpen(false);
  };

  return (
    <>
      <section className="presenter-controls">
        <div>
          <span className="panel-kicker">Presenter controls</span>
          <strong>{snapshot.source === "demo" ? "Demo match control" : "Live match control"}</strong>
        </div>
        <div className="presenter-actions">
          <button disabled={fanMeterHold} onClick={() => socket.emit(snapshot.running ? "pause" : "resume")}>
            {snapshot.running ? <Pause size={16} /> : <Play size={16} />}
            {fanMeterHold ? "Fan meter" : snapshot.running ? "Pause" : "Resume"}
          </button>
          <button disabled={fanMeterHold} onClick={() => socket.emit("nextBall")}>
            <Zap size={16} />
            Next ball
          </button>
          <button disabled={snapshot.source !== "demo"} onClick={() => socket.emit("jumpFinalOver")}>
            <Gauge size={16} />
            Final over
          </button>
          <button disabled={!demoMatches.length} onClick={() => setChooserOpen(true)}>
            <Settings size={16} />
            Change demo
          </button>
          <button onClick={() => socket.emit("replay")}>
            <RotateCcw size={16} />
            Restart
          </button>
        </div>
      </section>
      {chooserOpen && (
        <DemoChooserModal
          matches={demoMatches}
          selectedMatchId={snapshot.selectedMatchId}
          onSelect={switchDemo}
          onClose={() => setChooserOpen(false)}
        />
      )}
    </>
  );
}

function Loading({ connected }: { connected: boolean }) {
  return (
    <main className="app-shell loading-shell">
      <motion.div className="loading-core" animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.8 }}>
        <Brain />
        <span>{connected ? "Syncing match state" : "Connecting to DugoutAi server"}</span>
      </motion.div>
    </main>
  );
}

function MatchHub({
  snapshot,
  matches,
  status,
  connected,
  onRefresh
}: {
  snapshot: DashboardSnapshot;
  matches: MatchSummary[];
  status: string;
  connected: boolean;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const sourceLabel = snapshot.source === "demo" ? "Demo + optional API" : snapshot.matchFilter === "all" ? "RapidAPI Cricbuzz" : "IPL feed";
  const [demoChooserOpen, setDemoChooserOpen] = React.useState(false);
  const demoMatches = matches.filter((match) => match.id.startsWith("demo-"));
  const liveMatches = matches.filter((match) => !match.id.startsWith("demo-"));
  const startMatch = async (matchId: string) => {
    try {
      const response = await fetch(`${serverUrl}/matches/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId })
      });
      if (!response.ok) {
        throw new Error(`Match selection failed with ${response.status}`);
      }
      navigate("/room");
    } catch {
      socket.emit("selectMatch", matchId);
      window.setTimeout(() => navigate("/room"), 250);
    }
  };

  return (
    <section className="match-hub-shell">
      <div className="ambient-grid" />
      <section className="home-layout">
        <article className="product-story panel">
          <span className="panel-kicker">Second-screen cricket experience</span>
          <h1>DugoutAi makes fans part of the match, not just viewers.</h1>
          <p>
            Enjoy live cricket with your family and friends while Gemini-powered AI turns every key ball into commentary, fan battles, predictions, stadium sound, and shared match moments.
          </p>
          <div className="home-visual" aria-label="DugoutAi cricket experience preview">
            <div className="home-visual-score">
              <span>RCB vs CSK</span>
              <strong>Need 6 off 1</strong>
              <small>Gemini powered</small>
            </div>
            <div className="home-avatar-row">
              <div className="cricket-avatar rcb tease">
                <div className="home-avatar-head" />
                <div className="home-avatar-body">RCB</div>
                <span>NO</span>
              </div>
              <div className="home-ball-trail">
                <i />
                <b>YES</b>
                <i />
              </div>
              <div className="cricket-avatar csk celebrate">
                <div className="home-avatar-head" />
                <div className="home-avatar-body">CSK</div>
                <span>YES</span>
              </div>
            </div>
            <div className="home-moment-strip">
              <span>AI commentary</span>
              <span>Fan meter</span>
              <span>Win pulse</span>
            </div>
          </div>
          <div className="product-pill-row">
            <span>Enjoy with family and friends</span>
            <span>Gemini-powered agents</span>
            <span>Real-time fan participation</span>
            <span>Live AI commentary</span>
            <span>Match predictions</span>
          </div>
          <div className="product-proof-grid">
            <div>
              <strong>Live</strong>
              <span>score-driven moments</span>
            </div>
            <div>
              <strong>AI</strong>
              <span>commentary and strategy</span>
            </div>
            <div>
              <strong>Fans</strong>
              <span>predict, react, connect</span>
            </div>
          </div>
          <div className="product-flow">
            <span>Live score</span>
            <i />
            <span>Key moment</span>
            <i />
            <span>AI agents</span>
            <i />
            <span>Fan experience</span>
          </div>
        </article>

        <aside className="match-mode-panel">
          <div className="mode-panel-head">
            <div>
              <span className="panel-kicker">Judge launchpad</span>
              <h2>Start the showcase</h2>
            </div>
            <button aria-label="Refresh IPL matches" onClick={onRefresh}>
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="mode-choice-grid">
            <article className="mode-choice-card primary">
              <span className="panel-kicker">Best for judges</span>
              <h2>Interactive Super Over</h2>
              <p>A short RCB vs CSK climax where judges can feel the second-screen idea: families predict together, friends react live, AI voices speak, and the fan meter swings ball by ball.</p>
              <div className="mode-steps">
                <span>2 minutes</span>
                <span>Full experience</span>
                <span>High-impact demo</span>
              </div>
              <button type="button" disabled={!demoMatches.length} onClick={() => setDemoChooserOpen(true)}>
                Choose demo mode
              </button>
            </article>

            <article className="mode-choice-card">
              <span className="panel-kicker">Real data mode</span>
              <h2>Live match room</h2>
              <p>Connect a live scorecard and DugoutAi uses Gemini-powered agents to create commentary, insights, and crowd energy from the match as it unfolds.</p>
              <div className="mode-steps">
                <span>{liveMatches.length ? `${liveMatches.length} options` : "No live matches"}</span>
                <span>{snapshot.source === "demo" ? "Demo active" : "Live-ready"}</span>
              </div>
              <button type="button" onClick={onRefresh}>
                Refresh live matches
              </button>
            </article>
          </div>

          <section className="api-match-section">
            <div className="section-head">
              <div>
                <span className="panel-kicker">Optional live API</span>
                <h2>Available matches</h2>
              </div>
              <p>{status}</p>
            </div>
            <MatchGrid matches={liveMatches} selectedMatchId={snapshot.selectedMatchId} actionLabel="Start live match" onSelect={startMatch} />
          </section>

          <div className="hub-status">
            <Metric label="Socket" value={connected ? "Online" : "Offline"} />
            <Metric label="Source" value={sourceLabel} />
            <Metric label="Selection" value={snapshot.selectedMatchId ? (snapshot.source === "demo" ? "Demo started" : "Live started") : "Choose mode"} />
          </div>
        </aside>
      </section>

      <footer className="site-footer">
        <span>DugoutAi</span>
        <p>Created by Aryan Gupta</p>
      </footer>
      {demoChooserOpen && (
        <DemoChooserModal
          matches={demoMatches}
          selectedMatchId={snapshot.selectedMatchId}
          onSelect={startMatch}
          onClose={() => setDemoChooserOpen(false)}
        />
      )}
    </section>
  );
}

function DemoChooserModal({
  matches,
  selectedMatchId,
  onSelect,
  onClose
}: {
  matches: MatchSummary[];
  selectedMatchId: string | null;
  onSelect: (matchId: string) => void;
  onClose: () => void;
}) {
  const sortedMatches = [...matches].sort((a, b) => (a.id.includes("super-over") ? -1 : b.id.includes("super-over") ? 1 : 0));

  return (
    <div className="demo-modal-backdrop" role="presentation" onClick={onClose}>
      <motion.section
        className="demo-modal panel"
        role="dialog"
        aria-modal="true"
        aria-label="Choose demo format"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Demo format</span>
            <h2>What should the judges watch?</h2>
          </div>
          <button className="modal-close" type="button" aria-label="Close demo chooser" onClick={onClose}>X</button>
        </div>
        <div className="demo-format-grid">
          {sortedMatches.map((match) => {
            const isSuperOver = match.id.includes("super-over");
            return (
              <article key={match.id} className={`demo-format-card ${isSuperOver ? "super" : ""} ${selectedMatchId === match.id ? "selected" : ""}`}>
                <span>{isSuperOver ? "Fast judge mode" : "Full experience"}</span>
                <h3>{isSuperOver ? "Watch Super Over" : "Watch 6-over match"}</h3>
                <p>{isSuperOver ? "A compressed RCB vs CSK climax with fan meters before both innings." : "The longer scripted match with full prediction rhythm and final-over pressure."}</p>
                <button type="button" onClick={() => onSelect(match.id)}>
                  {selectedMatchId === match.id ? "Restart this demo" : "Start this demo"}
                </button>
              </article>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}

function WaitingForLiveFeed({
  snapshot,
  matches,
  connected,
  onRefresh
}: {
  snapshot: DashboardSnapshot;
  matches: MatchSummary[];
  connected: boolean;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  return (
    <section className="loading-shell routed-loading">
      <section className="waiting-panel panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Live API mode</span>
            <h1>Waiting for real match data</h1>
          </div>
          <Radio className="pulse-icon" />
        </div>
        <p>{snapshot.feedStatus}</p>
        <MatchGrid
          matches={matches}
          selectedMatchId={snapshot.selectedMatchId}
          compact
          onSelect={(matchId) => {
            socket.emit("selectMatch", matchId);
            navigate("/room");
          }}
        />
        <div className="waiting-grid">
          <Metric label="Socket" value={connected ? "Online" : "Offline"} />
          <Metric label="Source" value="Live API" />
          <Metric label="Agents" value="Standby" />
          <Metric label="Fake data" value="Off" />
        </div>
        <div className="control-strip waiting-controls">
          <button aria-label={snapshot.running ? "Pause" : "Resume"} onClick={() => socket.emit(snapshot.running ? "pause" : "resume")}>
            {snapshot.running ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button aria-label="Refresh live session" onClick={() => socket.emit("replay")}>
            <RotateCcw size={18} />
          </button>
          <button aria-label="Refresh matches" onClick={onRefresh}>
            <Activity size={18} />
          </button>
        </div>
      </section>
    </section>
  );
}

function MatchGrid({
  matches,
  selectedMatchId,
  compact = false,
  actionLabel = "Start match",
  onSelect
}: {
  matches: MatchSummary[];
  selectedMatchId: string | null;
  compact?: boolean;
  actionLabel?: string;
  onSelect: (matchId: string) => void;
}) {
  if (!matches.length) {
    return (
      <div className="empty-matches panel">
        <p>No live API matches are available right now. Use the demo match above for the full guided experience, or add/verify API credentials and refresh.</p>
      </div>
    );
  }

  return (
    <section className={compact ? "match-grid compact" : "match-grid"}>
      {matches.map((match) => (
        <motion.article key={match.id} className={`match-card ${selectedMatchId === match.id ? "selected" : ""}`} whileHover={{ y: -4 }}>
          <div className="match-card-top">
            <span>{match.id.startsWith("demo-") ? "Demo" : match.matchStarted ? (match.matchEnded ? "Finished" : "Live") : "Upcoming"}</span>
            <strong>{formatMatchTime(match.dateTimeGMT)}</strong>
          </div>
          <h2>{match.name}</h2>
          <p>{match.status || match.series || match.venue || "Fixture listed by live API"}</p>
          <div className="team-row">
            {match.teams.map((team) => (
              <span key={team}>{team}</span>
            ))}
          </div>
          <button type="button" onClick={() => onSelect(match.id)}>
            {selectedMatchId === match.id ? "Started" : actionLabel}
          </button>
        </motion.article>
      ))}
    </section>
  );
}

function Diagnostics({ snapshot, connected, matchStatus }: { snapshot: DashboardSnapshot | null; connected: boolean; matchStatus: string }) {
  const [health, setHealth] = React.useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = React.useState<string | null>(null);

  const loadHealth = React.useCallback(async () => {
    try {
      setHealthError(null);
      const response = await fetch(`${serverUrl}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed with ${response.status}`);
      }
      setHealth((await response.json()) as HealthStatus);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "Unable to read backend health.");
    }
  }, []);

  React.useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const liveReady = Boolean(health?.rapidApiConfigured || health?.cricketApiConfigured);
  const liveProviderLabel = health?.liveProvider?.replaceAll("_", " ") ?? "Not loaded";

  return (
    <section className="diagnostics-grid">
      <div className="panel settings-hero">
        <div>
          <span className="panel-kicker">Demo and API setup</span>
          <h1>Settings</h1>
          <p>
            Run the hackathon demo with mocked cricket data, or add Cricbuzz/RapidAPI credentials in `.env` and refresh live matches.
          </p>
        </div>
        <button type="button" onClick={loadHealth}>
          <RotateCcw size={16} />
          Refresh status
        </button>
      </div>

      <div className="settings-mode-grid">
        <article className={`settings-mode-card ${snapshot?.source === "demo" ? "active" : ""}`}>
          <span className="panel-kicker">Recommended demo path</span>
          <h2>Demo mode</h2>
          <p>Uses a scripted 6-over thriller so judges can see pressure, predictions, avatars, crowd pulse, and AI commentary without waiting for real match data.</p>
          <div className="status-pill-row">
            <span className="status-pill ready">No API required</span>
            <span className="status-pill">{snapshot?.source === "demo" ? "Active now" : "Available"}</span>
          </div>
        </article>

        <article className={`settings-mode-card ${liveReady ? "ready" : ""}`}>
          <span className="panel-kicker">Optional production path</span>
          <h2>Live API mode</h2>
          <p>Add provider credentials in `.env`, keep demo mode as fallback, then use the match picker to start a live fixture.</p>
          <div className="status-pill-row">
            <span className={`status-pill ${liveReady ? "ready" : "warning"}`}>{liveReady ? "Credentials detected" : "Credentials missing"}</span>
            <span className="status-pill">{liveProviderLabel}</span>
          </div>
        </article>
      </div>

      <div className="panel diagnostics-card settings-card">
        <div className="settings-card-head">
          <div>
            <span className="panel-kicker">Runtime</span>
            <h2>Current status</h2>
          </div>
          <span className={`status-pill ${health?.ok ? "ready" : "warning"}`}>{health?.ok ? "Backend online" : connected ? "Socket online" : "Offline"}</span>
        </div>
        <div className="waiting-grid">
          <Metric label="Socket" value={connected ? "Online" : "Offline"} />
          <Metric label="Active source" value={snapshot?.source ?? health?.activeSource ?? "Unknown"} />
          <Metric label="Provider" value={health?.cricketProvider ?? "Loading"} />
          <Metric label="Poll" value={health ? `${health.pollMs}ms` : "Loading"} />
        </div>
        <div className="settings-copy">
          <p>{matchStatus}</p>
          <p>{snapshot?.feedStatus ?? "Waiting for backend snapshot."}</p>
          {healthError && <p className="settings-error">{healthError}</p>}
        </div>
      </div>

      <div className="settings-detail-grid">
        <article className="panel settings-card">
          <span className="panel-kicker">API credentials</span>
          <h2>Live data checklist</h2>
          <div className="config-list">
            <ConfigRow label="RapidAPI key + host" ready={Boolean(health?.rapidApiConfigured)} value={health?.rapidApiConfigured ? "Configured" : "Add RAPIDAPI_KEY and RAPIDAPI_HOST"} />
            <ConfigRow label="Cricket API key" ready={Boolean(health?.cricketApiConfigured)} value={health?.cricketApiConfigured ? "Configured" : "Optional fallback"} />
            <ConfigRow label="Match id override" ready={Boolean(health?.cricketMatchId)} value={health?.cricketMatchId ?? "Not pinned"} />
            <ConfigRow label="Featured IPL URLs" ready={Boolean(health?.freeCricbuzzPaths.featuredIplUrls)} value={health?.freeCricbuzzPaths.featuredIplUrls ?? "Optional"} />
          </div>
        </article>

        <article className="panel settings-card">
          <span className="panel-kicker">AI experience</span>
          <h2>Commentary stack</h2>
          <div className="config-list">
            <ConfigRow label="Gemini agent key" ready={Boolean(health?.geminiConfigured)} value={health?.geminiConfigured ? "Configured" : "Add GEMINI_API_KEY"} />
            <ConfigRow label="Voice output" ready={Boolean(health?.ttsEnabled)} value={health?.ttsEnabled ? "Enabled" : "Disabled"} />
            <ConfigRow label="Language" ready={Boolean(health?.commentaryLanguage)} value={health?.commentaryLanguage ?? "Not loaded"} />
            <ConfigRow label="Cricbuzz commentary" ready={Boolean(health?.cricbuzzCommentaryEnabled)} value={health?.cricbuzzCommentaryEnabled ? "Enabled" : "Agent commentary only"} />
          </div>
        </article>
      </div>

      <div className="panel settings-card env-card">
        <span className="panel-kicker">How to switch</span>
        <h2>Environment guide</h2>
        <div className="env-lines">
          <code>CRICKET_PROVIDER=demo</code>
          <code>CRICKET_LIVE_PROVIDER=free_rapidapi_cricbuzz</code>
          <code>RAPIDAPI_KEY=your_key_here</code>
          <code>RAPIDAPI_HOST=your_host_here</code>
        </div>
        <p>Keep demo mode for the pitch. When credentials are present, live fixtures appear beside the demo match on the start screen.</p>
      </div>
    </section>
  );
}

function ConfigRow({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return (
    <div className="config-row">
      <span className={ready ? "config-dot ready" : "config-dot warning"} />
      <div>
        <strong>{label}</strong>
        <p>{value}</p>
      </div>
    </div>
  );
}

function formatMatchTime(value: string) {
  if (!value) {
    return "Time TBA";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function TopBar({
  snapshot,
  matchState,
  selectedMatch,
  connected
}: {
  snapshot: DashboardSnapshot;
  matchState: MatchState;
  selectedMatch?: MatchSummary;
  connected: boolean;
}) {
  const fanMeterHold = snapshot.selectedMatchId?.includes("super-over") && snapshot.feedStatus.includes("Fan meter opens");

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">
          <span className={connected ? "live-dot" : "offline-dot"} />
        {connected ? snapshot.feedStatus : "Offline"}
        {snapshot.source === "demo" && <strong className="demo-badge">Demo</strong>}
        </div>
        <h1>DugoutAi War Room</h1>
        <p className="topbar-subtitle">{selectedMatch?.name ?? `${matchState.battingTeam.name} innings`}</p>
      </div>
      <div className="match-chip">
        <Shield size={18} />
        <span>{matchState.battingTeam.name}</span>
        <strong>vs</strong>
        <span>{matchState.bowlingTeam.name}</span>
      </div>
      <div className="control-strip">
        <button aria-label="Replay demo" onClick={() => socket.emit("replay")}>
          <RotateCcw size={18} />
        </button>
        <button disabled={fanMeterHold} aria-label={fanMeterHold ? "Fan meter running" : snapshot.running ? "Pause" : "Resume"} onClick={() => socket.emit(snapshot.running ? "pause" : "resume")}>
          {snapshot.running ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
    </header>
  );
}

function ScoreDeck({
  matchState,
  latestBall,
  selectedMatch,
  selectedSide
}: {
  matchState: MatchState;
  latestBall: BallEvent | null;
  selectedMatch?: MatchSummary;
  selectedSide: string | null;
}) {
  const state = matchState;
  const hasTarget = state.target > 0;
  const needed = hasTarget ? Math.max(0, state.target - state.score) : "N/A";
  const overGroups = groupBallsByOver(state.recentBalls);
  const currentOver = overGroups[overGroups.length - 1];
  const recentOvers = overGroups.slice(0, -1).reverse();

  return (
    <section className="score-hero panel broadcast-score">
      <div className="score-hero-top">
        <div>
          <span className="panel-kicker">Live score</span>
          <h2>{state.battingTeam.shortName}</h2>
          <p>{selectedMatch?.status || "Live scorecard update"}</p>
        </div>
        <Radio className="pulse-icon" />
      </div>

      <div className="score-hero-body">
        <div>
          <div className="team-versus">
            <TeamBadge team={state.battingTeam.name} shortName={state.battingTeam.shortName} />
            <span>vs</span>
            <TeamBadge team={state.bowlingTeam.name} shortName={state.bowlingTeam.shortName} muted />
          </div>
          <motion.div key={`${state.score}-${state.wickets}`} className="scoreline" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {state.score}<span>/{state.wickets}</span>
          </motion.div>
          <div className="score-meta">
            <span>Overs {state.overs}</span>
            <span>RPO {state.runRate.toFixed(2)}</span>
            <span>{hasTarget ? `Need ${needed}` : "Target N/A"}</span>
          </div>
          <div className="side-chip">
            {selectedSide ? `You support ${selectedSide}` : "Choose your side in the fan arena"}
          </div>
        </div>

        <div className="player-focus">
          <div>
            <span>On strike</span>
            <strong>{state.striker || "Awaiting striker"}</strong>
          </div>
          <div>
            <span>Bowling</span>
            <strong>{state.bowler || "Awaiting bowler"}</strong>
          </div>
        </div>
      </div>

      <div className="over-strip-board">
        <div className="over-strip-head">
          <span>Current over</span>
          <strong>{currentOver ? `${currentOver.over}.${currentOver.balls[currentOver.balls.length - 1]?.ball ?? 0}` : "Waiting"}</strong>
        </div>
        <div className="over-ball-strip current">
          {(currentOver?.balls ?? []).map((ball) => (
            <motion.span key={ball.id} className={`ball-pill ${ball.outcome}`} layout initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {outcomeLabel[ball.outcome]}
            </motion.span>
          ))}
          {!currentOver && <p className="muted-copy">Over events appear after the score changes.</p>}
        </div>
        {!!recentOvers.length && (
          <div className="recent-over-rail" aria-label="Swipe recent overs">
            {recentOvers.map((group) => (
              <div className="recent-over-card" key={group.over}>
                <span>Over {group.over}</span>
                <div className="over-ball-strip">
                  {group.balls.map((ball) => (
                    <strong key={ball.id} className={`ball-pill ${ball.outcome}`}>
                      {outcomeLabel[ball.outcome]}
                    </strong>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {latestBall && (
          <motion.div className="last-event" key={latestBall.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Zap size={18} />
            <span>{latestBall.commentarySeed}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function TeamBadge({ team, shortName, muted = false }: { team: string; shortName: string; muted?: boolean }) {
  const teamClass = shortName.toLowerCase() === "rcb" ? "rcb" : shortName.toLowerCase() === "csk" ? "csk" : "";

  return (
    <div className={`team-badge ${teamClass} ${muted ? "muted" : ""}`}>
      <div>{shortName.slice(0, 3)}</div>
      <strong>{shortName}</strong>
      <span>{team}</span>
    </div>
  );
}

function FanArena({
  matchState,
  feedStatus,
  outputs,
  activities,
  latestBall,
  prediction,
  selectedSide,
  lastResult,
  fanScore,
  streak,
  bestStreak,
  totalPredictions,
  correctPredictions,
  onPredict,
  onSelectSide,
  fanBattle,
  onFanBattleUpdate,
  voiceEnabled,
  onEnableVoice,
  onStopVoice
}: {
  matchState: MatchState;
  feedStatus: string;
  outputs: AgentOutput[];
  activities: AgentActivity[];
  latestBall: BallEvent | null;
  prediction: PredictionChoice | null;
  selectedSide: string | null;
  lastResult: { correct: boolean; points: number; text: string } | null;
  fanScore: number;
  streak: number;
  bestStreak: number;
  totalPredictions: number;
  correctPredictions: number;
  onPredict: (choice: PredictionChoice) => void;
  onSelectSide: (side: string) => void;
  fanBattle: FanBattleSnapshot | null;
  onFanBattleUpdate: (snapshot: FanBattleSnapshot) => void;
  voiceEnabled: boolean;
  onEnableVoice: () => void;
  onStopVoice: () => void;
}) {
  const [countdown, setCountdown] = React.useState(10);
  const [dugoutScene, setDugoutScene] = React.useState<DugoutScene>("welcome");
  const [cheerPhase, setCheerPhase] = React.useState<CheerPhase>("batting");
  const [cheerCountdown, setCheerCountdown] = React.useState(10);
  const [manualDugoutScene, setManualDugoutScene] = React.useState(false);
  const [cheerBoost, setCheerBoost] = React.useState({ batting: 0, bowling: 0 });
  const [micEnabled, setMicEnabled] = React.useState(false);
  const [micLevel, setMicLevel] = React.useState(0);
  const [stadiumFxEnabled, setStadiumFxEnabled] = React.useState(false);
  const [crowdEnabled, setCrowdEnabled] = React.useState(false);
  const [tuneEnabled, setTuneEnabled] = React.useState(false);
  const [allSoundMuted, setAllSoundMuted] = React.useState(false);
  const [fanMeterIntroCountdown, setFanMeterIntroCountdown] = React.useState(8);
  const [eventAlert, setEventAlert] = React.useState<"wicket" | "noBall" | null>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const fxAudioContextRef = React.useRef<AudioContext | null>(null);
  const crowdAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const tuneAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const tuneIntervalRef = React.useRef<number | null>(null);
  const allSoundMutedRef = React.useRef(false);
  const crowdEnabledRef = React.useRef(false);
  const tuneEnabledRef = React.useRef(false);
  const noBallCountRef = React.useRef(matchState.scorecard?.extras.noBalls ?? 0);
  const noBallEventRef = React.useRef<string | null>(null);
  const boundaryEventRef = React.useRef<string | null>(null);
  const wicketEventRef = React.useRef<string | null>(null);
  const cskWinCheerRef = React.useRef<string | null>(null);
  const fanMeterAudioAtRef = React.useRef(0);
  const superOverFanMeterRef = React.useRef<string | null>(null);
  const autoSoundStartedRef = React.useRef<string | null>(null);
  const fanBattleRunRef = React.useRef(0);
  const fanBattleRuntimeRef = React.useRef<{
    battingCheer: number;
    bowlingCheer: number;
    battingTeam: string;
    bowlingTeam: string;
    score: number;
    wickets: number;
    micEnabled: boolean;
    micLevel: number;
    stadiumFxEnabled: boolean;
    onFanBattleUpdate: (snapshot: FanBattleSnapshot) => void;
    playAttentionFx: (kind?: "siren" | "battle" | "result") => void;
    fanMeterCheckpoint: boolean;
  }>({
    battingCheer: 0,
    bowlingCheer: 0,
    battingTeam: "",
    bowlingTeam: "",
    score: 0,
    wickets: 0,
    micEnabled: false,
    micLevel: 0,
    stadiumFxEnabled: false,
    onFanBattleUpdate,
    playAttentionFx: (_kind?: "siren" | "battle" | "result") => undefined,
    fanMeterCheckpoint: false
  });
  const animationFrameRef = React.useRef<number | null>(null);
  const commentary = outputs.filter((output) => output.agentId.includes("commentary")).slice(0, 4);
  const leadCommentary = commentary[0];
  const supportingCommentary = commentary.slice(1);
  const activeAgent = activities.find((activity) => activity.status === "thinking" || activity.status === "speaking");
  const pressure = pressureValue(matchState);
  const commentaryTone = commentaryToneFromBall(latestBall);
  const battingMood = latestBall?.outcome === "wicket" ? "stunned" : isGoodForBatting(latestBall) ? "celebrate" : "nervous";
  const bowlingMood = latestBall?.outcome === "wicket" ? "celebrate" : isGoodForBatting(latestBall) ? "frustrated" : "smirk";
  const hasTarget = matchState.target > 0;
  const runsNeeded = hasTarget ? Math.max(0, matchState.target - matchState.score) : 0;
  const inningsBalls = matchState.matchId.includes("super-over") ? 6 : 36;
  const isSuperOverMode = matchState.matchId.includes("super-over");
  const isSuperOverInningsBreak = isSuperOverMode && feedStatus.includes("Innings break");
  const startSceneTitle = isSuperOverInningsBreak ? "CSK chase is live" : "Super Over is live";
  const startSceneQuote = isSuperOverInningsBreak ? "Nineteen to win. One over. No hiding now." : "Six balls. One roar. Let the Super Over begin.";
  const startSceneSubcopy = isSuperOverInningsBreak ? "Dhoni walks in with the yellow wall behind him." : "Kohli takes strike with the red stand shaking.";
  const ballsLeft = Math.max(0, inningsBalls - legalBallsFromOvers(matchState.overs));
  const isComplete = matchState.target > 0 && matchState.score >= matchState.target;
  const fanAccuracy = totalPredictions ? Math.round((correctPredictions / totalPredictions) * 100) : 0;
  const selectedTeamWon = selectedSide ? selectedSide === matchState.battingTeam.shortName : null;
  const battingCheer = Math.min(99, Math.max(12, Math.round(matchState.crowdEnergy * 0.52 + matchState.winProbability * 0.32 + cheerBoost.batting)));
  const bowlingCheer = Math.min(99, Math.max(12, Math.round(matchState.crowdEnergy * 0.48 + (100 - matchState.winProbability) * 0.34 + cheerBoost.bowling)));
  const louderTeam = battingCheer >= bowlingCheer ? matchState.battingTeam.shortName : matchState.bowlingTeam.shortName;
  const displayFanBattle = fanBattle ?? {
    battingTeam: matchState.battingTeam.shortName,
    bowlingTeam: matchState.bowlingTeam.shortName,
    battingScore: battingCheer,
    bowlingScore: bowlingCheer,
    winner: louderTeam,
    phase: dugoutScene,
    updatedAt: Date.now()
  };
  const activeCheerTeam = cheerPhase === "batting" ? matchState.battingTeam.shortName : matchState.bowlingTeam.shortName;
  const activeCheerAudio = cheerPhase === "batting" ? stadiumAudio.teamCheer : stadiumAudio.opponentCheer;
  const isDhoniFinalSix =
    isSuperOverMode &&
    matchState.battingTeam.shortName === "CSK" &&
    latestBall?.outcome === "six" &&
    latestBall.striker === "MS Dhoni";
  const pollOptions = Object.keys(predictionLabels) as PredictionChoice[];
  const revealText =
    latestBall?.outcome === "wicket"
      ? "WICKET!"
      : latestBall?.outcome === "six"
        ? "SIX!"
        : latestBall?.outcome === "four" && isComplete
          ? "FINAL BALL FOUR!"
          : latestBall?.outcome === "four"
            ? "FOUR!"
            : latestBall
              ? outcomeLabel[latestBall.outcome]
              : "";

  const playAttentionFx = React.useCallback((kind: "siren" | "battle" | "result" = "siren") => {
    if (allSoundMutedRef.current) {
      return;
    }
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = fxAudioContextRef.current ?? new AudioContextCtor();
    fxAudioContextRef.current = context;
    if (context.state === "suspended") {
      void context.resume();
    }
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(kind === "result" ? 0.08 : 0.11, now + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "battle" ? 0.9 : 1.35));
    master.connect(context.destination);

    const notes = kind === "battle" ? [440, 660, 880] : kind === "result" ? [660, 990, 1320] : [720, 420, 720, 420];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "siren" ? "sawtooth" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.18);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * (kind === "siren" ? 1.35 : 1.08), now + index * 0.18 + 0.16);
      gain.gain.setValueAtTime(0.0001, now + index * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.45, now + index * 0.18 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.18 + 0.22);
      oscillator.connect(gain).connect(master);
      oscillator.start(now + index * 0.18);
      oscillator.stop(now + index * 0.18 + 0.25);
    });
  }, []);

  fanBattleRuntimeRef.current = {
    battingCheer,
    bowlingCheer,
    battingTeam: matchState.battingTeam.shortName,
    bowlingTeam: matchState.bowlingTeam.shortName,
    score: matchState.score,
    wickets: matchState.wickets,
    micEnabled,
    micLevel,
    stadiumFxEnabled,
    onFanBattleUpdate,
    playAttentionFx,
    fanMeterCheckpoint: isSuperOverMode && feedStatus.includes("Fan meter opens")
  };

  const playStadiumOneShot = React.useCallback((src: string, volume = 0.78) => {
    if (allSoundMutedRef.current) {
      return;
    }
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => undefined);
  }, []);

  const playLeagueTune = React.useCallback(() => {
    playStadiumOneShot(stadiumAudio.leagueTune, 0.48);
  }, [playStadiumOneShot]);

  const startCrowdLoop = React.useCallback(() => {
    allSoundMutedRef.current = false;
    setAllSoundMuted(false);
    crowdEnabledRef.current = true;
    setCrowdEnabled(true);

    const audio = crowdAudioRef.current ?? new Audio(stadiumAudio.crowdBed);
    audio.loop = true;
    audio.volume = 0.26;
    audio.onpause = () => {
      if (!crowdEnabledRef.current || allSoundMutedRef.current) {
        return;
      }
      window.setTimeout(() => {
        if (crowdEnabledRef.current && !allSoundMutedRef.current) {
          void audio.play().catch(() => undefined);
        }
      }, 250);
    };
    audio.onended = audio.onpause;
    crowdAudioRef.current = audio;
    void audio.play().catch(() => setCrowdEnabled(false));
  }, []);

  const startTuneLoop = React.useCallback(() => {
    allSoundMutedRef.current = false;
    setAllSoundMuted(false);
    tuneEnabledRef.current = true;
    setTuneEnabled(true);

    const audio = tuneAudioRef.current ?? new Audio(stadiumAudio.leagueTune);
    audio.loop = true;
    audio.volume = 0.48;
    audio.onpause = () => {
      if (!tuneEnabledRef.current || allSoundMutedRef.current) {
        return;
      }
      window.setTimeout(() => {
        if (tuneEnabledRef.current && !allSoundMutedRef.current) {
          void audio.play().catch(() => undefined);
        }
      }, 250);
    };
    audio.onended = audio.onpause;
    tuneAudioRef.current = audio;
    void audio.play().catch(() => setTuneEnabled(false));
  }, []);

  const toggleCrowdBed = React.useCallback(() => {
    if (crowdEnabled) {
      crowdEnabledRef.current = false;
      crowdAudioRef.current?.pause();
      setCrowdEnabled(false);
      return;
    }

    startCrowdLoop();
  }, [crowdEnabled, startCrowdLoop]);

  const toggleLeagueTune = React.useCallback(() => {
    if (tuneEnabled) {
      tuneEnabledRef.current = false;
      tuneAudioRef.current?.pause();
      if (tuneIntervalRef.current) {
        window.clearInterval(tuneIntervalRef.current);
        tuneIntervalRef.current = null;
      }
      setTuneEnabled(false);
      return;
    }

    startTuneLoop();
  }, [startTuneLoop, tuneEnabled]);

  const muteAllSound = React.useCallback(() => {
    allSoundMutedRef.current = true;
    crowdEnabledRef.current = false;
    tuneEnabledRef.current = false;
    setAllSoundMuted(true);
    setStadiumFxEnabled(false);
    setTuneEnabled(false);
    setCrowdEnabled(false);
    crowdAudioRef.current?.pause();
    tuneAudioRef.current?.pause();
    if (tuneIntervalRef.current) {
      window.clearInterval(tuneIntervalRef.current);
      tuneIntervalRef.current = null;
    }
  }, []);

  const unmuteAllSound = React.useCallback(() => {
    allSoundMutedRef.current = false;
    setAllSoundMuted(false);
    setStadiumFxEnabled(true);

    startCrowdLoop();
    startTuneLoop();
  }, [startCrowdLoop, startTuneLoop]);

  React.useEffect(() => {
    allSoundMutedRef.current = allSoundMuted;
  }, [allSoundMuted]);

  React.useEffect(() => {
    crowdEnabledRef.current = crowdEnabled;
  }, [crowdEnabled]);

  React.useEffect(() => {
    tuneEnabledRef.current = tuneEnabled;
  }, [tuneEnabled]);

  React.useEffect(() => {
    if (autoSoundStartedRef.current === matchState.matchId || allSoundMuted) {
      return;
    }

    autoSoundStartedRef.current = matchState.matchId;
    setStadiumFxEnabled(true);
    onEnableVoice();

    startCrowdLoop();
    startTuneLoop();
  }, [allSoundMuted, matchState.matchId, onEnableVoice, startCrowdLoop, startTuneLoop]);

  React.useEffect(() => {
    setCountdown(10);
    const id = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [matchState.overs, latestBall?.id]);

  React.useEffect(() => {
    if (isSuperOverMode && !latestBall) {
      const key = `${matchState.matchId}-${matchState.battingTeam.shortName}-${matchState.score}/${matchState.wickets}`;
      if (superOverFanMeterRef.current !== key) {
        superOverFanMeterRef.current = key;
        setManualDugoutScene(true);
        setDugoutScene("fanMeterIntro");
      }
      return;
    }

    if (manualDugoutScene || dugoutScene === "listening" || dugoutScene === "fanMeterIntro" || dugoutScene === "cheerPrompt" || dugoutScene === "battleResult") {
      return;
    }
    if (!latestBall) {
      setDugoutScene("welcome");
      return;
    }

    const firstScene: DugoutScene = isComplete ? "battleResult" : pressure >= 81 ? "pressure" : latestBall.outcome === "six" || latestBall.outcome === "wicket" || latestBall.outcome === "four" ? "replay" : "prediction";
    const secondScene: DugoutScene = firstScene === "battleResult" ? "battleResult" : isSuperOverMode ? "prediction" : "fanMeterIntro";
    setDugoutScene(firstScene);
    const id = window.setTimeout(() => setDugoutScene(secondScene), firstScene === "pressure" ? 9000 : 6500);
    return () => window.clearTimeout(id);
  }, [dugoutScene, isComplete, isSuperOverMode, latestBall, latestBall?.id, latestBall?.outcome, manualDugoutScene, matchState.battingTeam.shortName, matchState.matchId, matchState.score, matchState.wickets, pressure]);

  React.useEffect(() => {
    if (dugoutScene !== "battleResult" || isComplete) {
      return;
    }

    const id = window.setTimeout(() => setDugoutScene("prediction"), 9000);
    return () => window.clearTimeout(id);
  }, [dugoutScene, isComplete]);

  React.useEffect(() => {
    if (dugoutScene !== "fanMeterIntro") {
      return;
    }

    setCheerPhase("batting");
    setFanMeterIntroCountdown(8);
    const now = Date.now();
    if (now - fanMeterAudioAtRef.current > 1600) {
      fanMeterAudioAtRef.current = now;
      playStadiumOneShot(stadiumAudio.fanMeterCall, 0.86);
    }

    const countdownId = window.setInterval(() => {
      setFanMeterIntroCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    const sceneId = window.setTimeout(() => setDugoutScene("cheerPrompt"), 8000);
    return () => {
      window.clearInterval(countdownId);
      window.clearTimeout(sceneId);
    };
  }, [dugoutScene, playStadiumOneShot]);

  React.useEffect(() => {
    if (dugoutScene !== "cheerPrompt") {
      return;
    }

    const now = Date.now();
    if (now - fanMeterAudioAtRef.current > 4400) {
      fanMeterAudioAtRef.current = now;
      playStadiumOneShot(stadiumAudio.fanMeterCall, 0.78);
    }
  }, [dugoutScene, playStadiumOneShot]);

  React.useEffect(() => {
    if (!stadiumFxEnabled) {
      return;
    }
    if (dugoutScene === "pressure") {
      playAttentionFx("siren");
    } else if (dugoutScene === "cheerPrompt") {
      playAttentionFx("battle");
    } else if (dugoutScene === "battleResult") {
      playAttentionFx("result");
    }
  }, [dugoutScene, playAttentionFx, stadiumFxEnabled]);

  React.useEffect(() => {
    const currentNoBalls = matchState.scorecard?.extras.noBalls ?? 0;
    if (currentNoBalls > noBallCountRef.current && latestBall?.outcome !== "noBall") {
      playStadiumOneShot(stadiumAudio.noBallSting, 0.9);
      setEventAlert("noBall");
    }
    noBallCountRef.current = currentNoBalls;
  }, [latestBall?.outcome, matchState.scorecard?.extras.noBalls, playStadiumOneShot]);

  React.useEffect(() => {
    if (!latestBall) {
      return;
    }

    const text = latestBall.commentarySeed.toLowerCase();
    const isNoBallCall = latestBall.outcome === "noBall" || text.includes("no ball") || text.includes("noball");
    if (!isNoBallCall || noBallEventRef.current === latestBall.id) {
      return;
    }

    noBallEventRef.current = latestBall.id;
    playStadiumOneShot(stadiumAudio.noBallSting, 0.9);
    setEventAlert("noBall");
  }, [latestBall, playStadiumOneShot]);

  React.useEffect(() => {
    if (!latestBall || (latestBall.outcome !== "four" && latestBall.outcome !== "six") || boundaryEventRef.current === latestBall.id) {
      return;
    }

    boundaryEventRef.current = latestBall.id;
    if (isDhoniFinalSix) {
      cskWinCheerRef.current = latestBall.id;
      playStadiumOneShot(stadiumAudio.dhoniFinish, 0.96);
      window.setTimeout(() => playStadiumOneShot(stadiumAudio.opponentCheer, 0.9), 21000);
      return;
    }

    playStadiumOneShot(stadiumAudio.boundarySting, latestBall.outcome === "six" ? 0.96 : 0.88);
  }, [isDhoniFinalSix, latestBall, playStadiumOneShot]);

  React.useEffect(() => {
    if (!latestBall || latestBall.outcome !== "wicket" || wicketEventRef.current === latestBall.id) {
      return;
    }

    wicketEventRef.current = latestBall.id;
    playStadiumOneShot(stadiumAudio.wicketSting, 0.92);
    setEventAlert("wicket");
  }, [latestBall, playStadiumOneShot]);

  React.useEffect(() => {
    if (!isSuperOverMode || !isComplete || matchState.battingTeam.shortName !== "CSK" || !latestBall || cskWinCheerRef.current === latestBall.id) {
      return;
    }

    cskWinCheerRef.current = latestBall.id;
    if (isDhoniFinalSix) {
      return;
    }

    window.setTimeout(() => playStadiumOneShot(stadiumAudio.opponentCheer, 0.86), 700);
  }, [isComplete, isDhoniFinalSix, isSuperOverMode, latestBall, matchState.battingTeam.shortName, playStadiumOneShot]);

  React.useEffect(() => {
    if (!eventAlert) {
      return;
    }

    const id = window.setTimeout(() => setEventAlert(null), eventAlert === "wicket" ? 2600 : 2400);
    return () => window.clearTimeout(id);
  }, [eventAlert]);

  React.useEffect(() => {
    if (dugoutScene !== "listening") {
      return;
    }

    const runId = fanBattleRunRef.current + 1;
    fanBattleRunRef.current = runId;
    setCheerCountdown(10);
    const finishCheerRun = () => {
      if (fanBattleRunRef.current !== runId) {
        return;
      }

      const runtime = fanBattleRuntimeRef.current;
      const liveBoost = runtime.micEnabled ? Math.min(26, Math.round(runtime.micLevel / 3)) : 0;
      const demoBoost = 7 + ((runtime.score + runtime.wickets + (cheerPhase === "batting" ? 4 : 9)) % 17);
      const nextBatting = cheerPhase === "batting" ? Math.min(99, runtime.battingCheer + demoBoost + liveBoost) : runtime.battingCheer;
      const nextBowling = cheerPhase === "bowling" ? Math.min(99, runtime.bowlingCheer + demoBoost + liveBoost) : runtime.bowlingCheer;

      setCheerCountdown(0);
      setCheerBoost((currentBoost) => ({
        batting: cheerPhase === "batting" ? Math.min(34, currentBoost.batting + demoBoost + liveBoost) : currentBoost.batting,
        bowling: cheerPhase === "bowling" ? Math.min(34, currentBoost.bowling + demoBoost + liveBoost) : currentBoost.bowling
      }));
      if (cheerPhase === "batting") {
        runtime.onFanBattleUpdate({
          battingTeam: runtime.battingTeam,
          bowlingTeam: runtime.bowlingTeam,
          battingScore: nextBatting,
          bowlingScore: nextBowling,
          winner: nextBatting >= nextBowling ? runtime.battingTeam : runtime.bowlingTeam,
          phase: "cheerPrompt",
          updatedAt: Date.now()
        });
        setCheerPhase("bowling");
        setManualDugoutScene(true);
        setDugoutScene("cheerPrompt");
      } else {
        const forceBattingWin = fanBattleWinnerHistory.next === "batting";
        fanBattleWinnerHistory.next = forceBattingWin ? "bowling" : "batting";
        const winnerBattingScore = forceBattingWin ? Math.max(nextBatting, nextBowling + 6) : Math.min(nextBatting, nextBowling - 6);
        const winnerBowlingScore = forceBattingWin ? Math.min(nextBowling, winnerBattingScore - 6) : Math.max(nextBowling, nextBatting + 6);
        const finalBattingScore = Math.max(8, Math.min(99, winnerBattingScore));
        const finalBowlingScore = Math.max(8, Math.min(99, winnerBowlingScore));
        runtime.onFanBattleUpdate({
          battingTeam: runtime.battingTeam,
          bowlingTeam: runtime.bowlingTeam,
          battingScore: finalBattingScore,
          bowlingScore: finalBowlingScore,
          winner: forceBattingWin ? runtime.battingTeam : runtime.bowlingTeam,
          phase: "battleResult",
          updatedAt: Date.now()
        });
        setCheerPhase("batting");
        setManualDugoutScene(false);
        setDugoutScene("battleResult");
        if (runtime.fanMeterCheckpoint) {
          window.setTimeout(() => {
            socket.emit("fanMeterComplete");
          }, 600);
        }
      }

      if (runtime.stadiumFxEnabled) {
        runtime.playAttentionFx(cheerPhase === "bowling" ? "result" : "battle");
      }
    };

    const intervalId = window.setInterval(() => {
      setCheerCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    const finishId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      finishCheerRun();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(finishId);
    };
  }, [cheerPhase, dugoutScene]);

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      crowdEnabledRef.current = false;
      tuneEnabledRef.current = false;
      crowdAudioRef.current?.pause();
      tuneAudioRef.current?.pause();
      if (tuneIntervalRef.current) {
        window.clearInterval(tuneIntervalRef.current);
      }
      void audioContextRef.current?.close();
      void fxAudioContextRef.current?.close();
    };
  }, []);

  const enableMicBattle = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicEnabled(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      const context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      micStreamRef.current = stream;
      audioContextRef.current = context;
      setMicEnabled(true);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / data.length;
        setMicLevel(Math.min(99, Math.round(average)));
        animationFrameRef.current = window.requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setMicEnabled(false);
    }
  }, []);

  const enableStadiumFx = React.useCallback(() => {
    allSoundMutedRef.current = false;
    setAllSoundMuted(false);
    setStadiumFxEnabled(true);
    playAttentionFx("siren");
  }, [playAttentionFx]);

  const enableVoiceSound = React.useCallback(() => {
    onEnableVoice();
  }, [onEnableVoice]);

  const openFansBattle = React.useCallback(() => {
    setManualDugoutScene(true);
    setDugoutScene("fanMeterIntro");
    setStadiumFxEnabled(true);
    playAttentionFx("battle");
  }, [playAttentionFx, playStadiumOneShot]);

  const startCheerCountdown = React.useCallback(() => {
    setManualDugoutScene(true);
    setStadiumFxEnabled(true);
    playAttentionFx("siren");
    playStadiumOneShot(activeCheerAudio, 0.72);
    setDugoutScene("listening");
  }, [activeCheerAudio, playAttentionFx, playStadiumOneShot]);

  return (
    <section className={`fan-arena panel broadcast-commentary ${dugoutScene === "fanMeterIntro" || dugoutScene === "cheerPrompt" || dugoutScene === "listening" ? "disco-takeover" : ""}`}>
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Fan arena</span>
          <h2>{isComplete ? "Final-ball thriller complete" : "Predict the next ball"}</h2>
        </div>
        <div className="fan-audio-actions">
          <button className={`voice-toggle ${!allSoundMuted ? "active" : ""}`} onClick={allSoundMuted ? unmuteAllSound : muteAllSound}>
            <Radio size={16} />
            {allSoundMuted ? "Unmute All" : "Mute All"}
          </button>
          <button className={`voice-toggle ${crowdEnabled ? "active" : ""}`} onClick={toggleCrowdBed}>
            <Radio size={16} />
            {crowdEnabled ? "Crowd On" : "Crowd"}
          </button>
          <button className={`voice-toggle ${tuneEnabled ? "active" : ""}`} onClick={toggleLeagueTune}>
            <Play size={16} />
            {tuneEnabled ? "Tune Auto" : "IPL Tune"}
          </button>
          <button className={`voice-toggle ${stadiumFxEnabled ? "active" : ""}`} onClick={enableStadiumFx}>
            <Radio size={16} />
            {stadiumFxEnabled ? "Stadium FX On" : "Enable Siren"}
          </button>
          <button className={`voice-toggle ${voiceEnabled ? "active" : ""}`} onClick={voiceEnabled ? onStopVoice : enableVoiceSound}>
            <Mic2 size={16} />
            {voiceEnabled ? "Stop Voice" : "Enable Voice"}
          </button>
        </div>
      </div>

      {!selectedSide && (
        <div className="side-select">
          <span>Pick your side</span>
          <button onClick={() => onSelectSide(matchState.battingTeam.shortName)}>{matchState.battingTeam.shortName}</button>
          <button onClick={() => onSelectSide(matchState.bowlingTeam.shortName)}>{matchState.bowlingTeam.shortName}</button>
        </div>
      )}

      <div className="duel-stage">
        <FanAvatar team={matchState.battingTeam.shortName} mood={battingMood} active={selectedSide === matchState.battingTeam.shortName} />
        <div className={`prediction-core fan-tv scene-${isComplete ? "climax" : dugoutScene} tone-${commentaryTone}`}>
          <AnimatePresence>
            {eventAlert && (
              <motion.div
                className={`event-takeover ${eventAlert}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
              >
                <span>{eventAlert === "wicket" ? "WICKET" : "NO BALL"}</span>
                <strong>{eventAlert === "wicket" ? "Red alert" : "Free hit pressure"}</strong>
                <p>{latestBall?.commentarySeed ?? (eventAlert === "wicket" ? "The stadium has erupted." : "The umpire has called it.")}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="tv-video-layer" aria-hidden="true">
            <span className="tv-beam beam-one" />
            <span className="tv-beam beam-two" />
            <span className="tv-scanline" />
            <span className="tv-vignette" />
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={index} className="tv-spark" style={{ "--spark-delay": `${index * 0.22}s`, "--spark-x": `${8 + index * 9}%` } as React.CSSProperties} />
            ))}
          </div>
          <div className="fan-tv-top">
            <span className={`pressure-tag ${pressure >= 81 ? "danger" : ""}`}>{pressureLabel(pressure)}</span>
            <div className="dugout-live-actions">
              <div className="dugout-live-badge">
                <Radio size={13} />
                Dugout.AI live
              </div>
              <button type="button" onClick={openFansBattle}>Fans Battle</button>
            </div>
          </div>
          {revealText && (
            <motion.div className={`ball-reveal ${latestBall?.outcome ?? ""}`} initial={{ scale: 0.72, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={latestBall?.id}>
              {revealText}
            </motion.div>
          )}
          {isComplete ? (
            <motion.div className="climax-card" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
              <span className="climax-kicker">
                <Sparkles size={15} />
                Match point
              </span>
              <strong>{matchState.battingTeam.shortName} win the thriller</strong>
              <p>Dhoni finishes it with a final-ball six. CSK take the Super Over.</p>
              <div className="climax-actions">
                <button onClick={() => socket.emit("replay")}>
                  <RotateCcw size={16} />
                  Replay thriller
                </button>
                <button onClick={() => socket.emit("jumpFinalOver")}>
                  <Gauge size={16} />
                  Run final over
                </button>
              </div>
            </motion.div>
          ) : dugoutScene === "welcome" ? (
            <motion.div className="fan-tv-mode dugout-welcome" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="video-title-burst" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span className="dugout-kicker">Welcome to</span>
              <strong>Dugout.AI</strong>
              <p>Fans Battle is armed. The stadium screen will call noise battles, pressure sirens, polls, and AI dugout reads as the match turns.</p>
              <button onClick={openFansBattle}>Start Fans Battle</button>
            </motion.div>
          ) : dugoutScene === "pressure" ? (
            <motion.div className="fan-tv-mode pressure-siren-mode" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
              <span className="siren-ring" />
              <span className="siren-ring outer" />
              <strong>Pressure Siren</strong>
              <p>{hasTarget ? `${matchState.battingTeam.shortName} need ${runsNeeded} from ${ballsLeft}. Every fan voice matters now.` : `Pressure at ${pressure}%.`}</p>
            </motion.div>
          ) : dugoutScene === "fanMeterIntro" ? (
            <motion.div className="fan-tv-mode fanmeter-intro-mode" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="video-title-burst" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              {isSuperOverInningsBreak ? (
                <>
                  <span className="dugout-kicker">Super Over chase</span>
                  <strong>RCB finish 18/2</strong>
                  <div className="innings-break-score">
                    <span>Target</span>
                    <b>CSK need 19 to win</b>
                  </div>
                  <p>Yellow stand gets the next Fans Battle before Dhoni walks out.</p>
                </>
              ) : (
                <>
                  <span className="dugout-kicker">Dugout.AI presents</span>
                  <strong>Ladies and gentlemen</strong>
                  <p>Are you ready?</p>
                </>
              )}
              <em className="fanmeter-intro-timer">{fanMeterIntroCountdown}s to fan meter</em>
              <div className="fanmeter-countdown" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </motion.div>
          ) : dugoutScene === "cheerPrompt" ? (
            <motion.div className="fan-tv-mode cheer-meter-mode" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <span className="dugout-kicker">Fans Battle</span>
              <strong>{activeCheerTeam}, make some noise</strong>
              <p>{cheerPhase === "batting" ? "First stand is ready. Hit start and cheer for 10 seconds." : "Now the other stand takes over. Hit start and beat that roar."}</p>
              <div className="cheer-actions">
                <button onClick={startCheerCountdown}>Start countdown</button>
                <button onClick={enableMicBattle}>{micEnabled ? "Mic active" : "Enable mic"}</button>
              </div>
              <em className="mic-note">{micEnabled ? `Live pitch meter ${micLevel}` : "Demo meter runs if mic permission is skipped."}</em>
            </motion.div>
          ) : dugoutScene === "listening" ? (
            <motion.div className="fan-tv-mode listening-mode" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              <span className="dugout-kicker">Recording cheer</span>
              <strong>{cheerCountdown || "Locking score"}</strong>
              <p>{activeCheerTeam} fans, louder now.</p>
              <div className="live-noise-orb" style={{ "--noise": `${micEnabled ? micLevel : 64 + cheerCountdown * 9}%` } as React.CSSProperties} />
              <div className="stadium-eq" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, index) => (
                  <span key={index} style={{ "--eq-delay": `${index * 0.04}s` } as React.CSSProperties} />
                ))}
              </div>
            </motion.div>
          ) : dugoutScene === "battleResult" ? (
            <motion.div className="fan-tv-mode cheer-meter-mode" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <span className="dugout-kicker">Fans Battle result</span>
              <strong>{displayFanBattle.winner} own this over</strong>
              <div className="cheer-meter-row">
                <span>{displayFanBattle.battingTeam}</span>
                <div><i style={{ width: `${displayFanBattle.battingScore}%` }} /></div>
                <strong>{displayFanBattle.battingScore}</strong>
              </div>
              <div className="cheer-meter-row bowling">
                <span>{displayFanBattle.bowlingTeam}</span>
                <div><i style={{ width: `${displayFanBattle.bowlingScore}%` }} /></div>
                <strong>{displayFanBattle.bowlingScore}</strong>
              </div>
              <button onClick={() => { setManualDugoutScene(false); setDugoutScene("prediction"); }}>Next AI prompt</button>
            </motion.div>
          ) : dugoutScene === "matchStart" ? (
            <motion.div className="fan-tv-mode match-start-mode" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <span className="dugout-kicker">Dugout.AI says</span>
              <strong>Let's start the match</strong>
              <div className="thriller-quote">
                <span>{startSceneTitle}</span>
                <b>{startSceneQuote}</b>
              </div>
              <p>{startSceneSubcopy}</p>
              <div className="start-lights" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
            </motion.div>
          ) : dugoutScene === "replay" ? (
            <motion.div className="fan-tv-mode replay-mode" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <span className="dugout-kicker">Dugout replay</span>
              <strong>{latestBall?.outcome === "wicket" ? "Wicket shake-up" : latestBall?.outcome === "six" ? "Launch detected" : "Momentum clip"}</strong>
              <p>{latestBall?.commentarySeed ?? "The TV will replay the latest match moment after the next reveal."}</p>
              <div className="replay-strip">
                {matchState.recentBalls.slice(-6).map((ball) => (
                  <span key={ball.id} className={ball.outcome}>{outcomeLabel[ball.outcome]}</span>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div className="fan-tv-mode prediction-mode" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <span className="dugout-kicker">AI asks the stand</span>
              <strong>{`Ball ${ballNumber(matchState)}`}</strong>
              <p>{hasTarget ? `Need ${runsNeeded} from ${ballsLeft}. Predict the next swing.` : "Predict the next swing."}</p>
              <div className="countdown-strip" aria-label="Next ball countdown">
                <span style={{ width: `${(countdown / 10) * 100}%` }} />
                <strong>{countdown ? `${countdown}s to reveal` : "Reveal incoming"}</strong>
              </div>
              <div className="prediction-options">
                {pollOptions.map((choice) => (
                  <button key={choice} className={prediction === choice ? "active" : ""} onClick={() => onPredict(choice)}>
                    {predictionLabels[choice]}
                  </button>
                ))}
              </div>
              {lastResult && (
                <div className={`prediction-result ${lastResult.correct ? "correct" : "wrong"}`}>
                  <span>{lastResult.correct ? `+${lastResult.points}` : "0"} pts</span>
                  <p>{lastResult.text}</p>
                </div>
              )}
            </motion.div>
          )}
          <div className="tv-bottom-ticker" aria-hidden="true">
            <span>Fans Battle Live</span>
            <span>{matchState.battingTeam.shortName} vs {matchState.bowlingTeam.shortName}</span>
            <span>{pressureLabel(pressure)} pressure</span>
          </div>
        </div>
        <FanAvatar team={matchState.bowlingTeam.shortName} mood={bowlingMood} active={selectedSide === matchState.bowlingTeam.shortName} />
      </div>

      <div className="live-agent-banner">
        <Radio size={16} />
        <span>{activeAgent ? `${activeAgent.label}: ${activeAgent.status}` : "Make your call before the next reveal"}</span>
      </div>

      {leadCommentary && (
        <motion.article
          className={`broadcast-spotlight ${leadCommentary.agentId} tone-${commentaryTone}`}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          key={leadCommentary.id}
        >
          <div className="spotlight-speaker">
            <span>{leadCommentary.agentId === "hype_commentary" ? "Akash live" : "Alia analysis"}</span>
            <strong>{commentaryTone === "six" ? "Crowd blast" : commentaryTone === "wicket" ? "Pressure spike" : commentaryTone === "boundary" ? "Momentum swing" : commentaryTone === "dot" ? "Tension ball" : "Broadcast booth"}</strong>
          </div>
          <p>{leadCommentary.text}</p>
          <div className="spotlight-bars" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <motion.span key={index} animate={{ height: [8, 22 + (index % 5) * 6, 10] }} transition={{ duration: 0.72, repeat: Infinity, delay: index * 0.035 }} />
            ))}
          </div>
        </motion.article>
      )}

      <div className="commentary-feed arena-feed">
        <AnimatePresence initial={false}>
          {supportingCommentary.map((item) => (
            <motion.article
              key={item.id}
              className={`commentary-card ${item.agentId}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              layout
            >
              <span>{item.label}</span>
              <p>{item.text}</p>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function FanAvatar({ team, mood, active }: { team: string; mood: string; active: boolean }) {
  const isRcb = team.toLowerCase().includes("rcb");
  const teamClass = isRcb ? "rcb" : "csk";
  const poseLabel =
    mood === "celebrate"
      ? "celebrating"
      : mood === "stunned"
        ? "shocked"
        : mood === "frustrated"
          ? "frustrated"
          : mood === "smirk"
            ? "teasing"
            : "waiting";

  return (
    <motion.div
      className={`fan-avatar ${mood} ${active ? "active" : ""} ${teamClass}`}
      animate={
        mood === "celebrate"
          ? { y: [0, -12, 0], rotate: [0, -3, 3, 0] }
          : mood === "stunned" || mood === "frustrated"
            ? { x: [0, -5, 5, 0] }
            : { scale: [1, 1.02, 1] }
      }
      transition={{ duration: 0.8, repeat: mood === "celebrate" ? 2 : 0 }}
    >
      <div className="avatar-character" aria-hidden="true">
        <span className="avatar-shadow" />
        <span className="avatar-arm left" />
        <span className="avatar-arm right" />
        <div className="avatar-body">
          <span className="avatar-scarf" />
          <strong>{team}</strong>
        </div>
        <div className="avatar-head">
          <span className="avatar-hair" />
          <span className="avatar-eye left" />
          <span className="avatar-eye right" />
          <span className="avatar-mouth" />
          <span className="avatar-cheek left" />
          <span className="avatar-cheek right" />
        </div>
        <span className="avatar-bubble">{mood === "celebrate" || mood === "smirk" ? "YES" : "NO"}</span>
      </div>
      <strong>{team}</strong>
      <p>{poseLabel}</p>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CommentaryRoom({
  outputs,
  activities,
  voiceEnabled,
  onEnableVoice,
  onStopVoice
}: {
  outputs: AgentOutput[];
  activities: AgentActivity[];
  voiceEnabled: boolean;
  onEnableVoice: () => void;
  onStopVoice: () => void;
}) {
  const commentary = outputs.filter((output) => output.agentId.includes("commentary")).slice(0, 5);
  const [filter, setFilter] = React.useState<"all" | "akash" | "alia">("all");
  const filtered =
    filter === "all" ? commentary : commentary.filter((output) => (filter === "akash" ? output.agentId === "hype_commentary" : output.agentId === "analyst_commentary"));
  const leadCommentary = filtered[0];
  const supportingCommentary = filtered.slice(1);
  const activeAgent = activities.find((activity) => activity.status === "thinking" || activity.status === "speaking");
  const leadTone = leadCommentary ? commentaryToneFromText(leadCommentary.text) : "normal";

  return (
    <section className="commentary-room panel fan-commentary broadcast-commentary">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">AI commentary room</span>
          <h2>Live broadcast voices</h2>
        </div>
        <button className={`voice-toggle ${voiceEnabled ? "active" : ""}`} onClick={voiceEnabled ? onStopVoice : onEnableVoice}>
          <Mic2 size={16} />
          {voiceEnabled ? "Stop Voice" : "Enable Voice"}
        </button>
      </div>
      <div className="segmented-control">
        {(["all", "akash", "alia"] as const).map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="speaker-stage compact-stage">
        <SpeakerCard title="Akash" mood="male hype voice" active={commentary[0]?.agentId === "hype_commentary"} />
        <div className="voice-wave">
          {Array.from({ length: 22 }).map((_, index) => (
            <motion.span
              key={index}
              animate={{ height: [10, 34 + (index % 6) * 5, 14] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.035 }}
            />
          ))}
        </div>
        <SpeakerCard title="Alia" mood="female analyst voice" active={commentary[0]?.agentId === "analyst_commentary"} />
      </div>
      <div className="live-agent-banner">
        <Radio size={16} />
        <span>{activeAgent ? `${activeAgent.label}: ${activeAgent.status}` : "Agents waiting for next scorecard update"}</span>
      </div>

      {leadCommentary && (
        <motion.article
          className={`broadcast-spotlight ${leadCommentary.agentId} tone-${leadTone}`}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          key={leadCommentary.id}
        >
          <div className="spotlight-speaker">
            <span>{leadCommentary.agentId === "hype_commentary" ? "Akash live" : "Alia analysis"}</span>
            <strong>{leadTone === "six" ? "Crowd blast" : leadTone === "wicket" ? "Pressure spike" : leadTone === "boundary" ? "Momentum swing" : leadTone === "dot" ? "Tension ball" : "Broadcast booth"}</strong>
          </div>
          <p>{leadCommentary.text}</p>
          <div className="spotlight-bars" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <motion.span key={index} animate={{ height: [8, 22 + (index % 5) * 6, 10] }} transition={{ duration: 0.72, repeat: Infinity, delay: index * 0.035 }} />
            ))}
          </div>
        </motion.article>
      )}

      <div className="commentary-feed">
        <AnimatePresence initial={false}>
          {supportingCommentary.map((item) => (
            <motion.article
              key={item.id}
              className={`commentary-card ${item.agentId}`}
              initial={{ opacity: 0, x: item.agentId === "hype_commentary" ? -30 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              layout
            >
              <span>{item.label}</span>
              <p>{item.text}</p>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function StoryStrip({ snapshot, matchState, chartData }: { snapshot: DashboardSnapshot; matchState: MatchState; chartData: Array<{ name: string; momentum: number }> }) {
  const latest = snapshot.moments[0];
  const prediction = snapshot.outputs.find((output) => output.agentId === "prediction");

  return (
    <section className="story-strip">
      <article className="story-card primary-story">
        <span className="panel-kicker">Why it matters</span>
        <h2>{latest?.title ?? "Waiting for the next moment"}</h2>
        <p>{latest?.reason ?? "The story will update when the live scorecard changes."}</p>
      </article>
      <article className="story-card">
        <span className="panel-kicker">Win pulse</span>
        <strong>{Math.round(matchState.winProbability)}%</strong>
        <div className="probability-track">
          <motion.span animate={{ width: `${matchState.winProbability}%` }} />
        </div>
      </article>
      <article className="story-card chart-story">
        <span className="panel-kicker">Momentum</span>
        <ResponsiveContainer width="100%" height={82}>
          <AreaChart data={chartData}>
            <Area type="monotone" dataKey="momentum" stroke="#29f2c2" fill="#29f2c2" fillOpacity={0.18} />
          </AreaChart>
        </ResponsiveContainer>
      </article>
      <article className="story-card">
        <span className="panel-kicker">AI read</span>
        <p>{prediction?.text ?? "Prediction agent will summarize the match once the next live event arrives."}</p>
      </article>
    </section>
  );
}

function SpeakerCard({ title, mood, active }: { title: string; mood: string; active: boolean }) {
  return (
    <motion.div className={`speaker-card ${active ? "active" : ""}`} animate={active ? { boxShadow: "0 0 45px rgba(41, 242, 194, 0.32)" } : {}}>
      <Brain size={26} />
      <strong>{title}</strong>
      <span>{mood}</span>
    </motion.div>
  );
}

function InsightStack({
  snapshot,
  matchState,
  chartData,
  fanScore,
  streak,
  selectedSide,
  fanBattle
}: {
  snapshot: DashboardSnapshot;
  matchState: MatchState;
  chartData: Array<{ name: string; momentum: number }>;
  fanScore: number;
  streak: number;
  selectedSide: string | null;
  fanBattle: FanBattleSnapshot | null;
}) {
  const state = matchState;
  const strategy = snapshot.outputs.find((output) => output.agentId === "strategy");
  const sentiment = snapshot.outputs.find((output) => output.agentId === "sentiment");
  const statsText = `${state.battingTeam.shortName} scoring at ${state.runRate.toFixed(2)} rpo with ${state.wickets} wickets down after ${state.overs} overs.`;
  const pressure = pressureValue(state);
  const runsNeeded = state.target > 0 ? Math.max(0, state.target - state.score) : 0;
  const inningsBalls = state.matchId.includes("super-over") ? 6 : 36;
  const ballsLeft = Math.max(0, inningsBalls - legalBallsFromOvers(state.overs));
  const projectionData = [
    { name: "Now", score: state.score },
    { name: "Projected", score: Math.max(state.score, state.projectedScore) },
    { name: "Target", score: state.target > 0 ? state.target : Math.max(state.score, state.projectedScore) }
  ];
  const selectedNote = selectedSide ? `${selectedSide} fans need every prediction now.` : "Choose a side to enter the fan duel.";

  return (
    <section className="insight-stack fan-insights">
      <div className="panel win-predictor-card">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Win predictor</span>
            <h2>{state.battingTeam.shortName} {Math.round(state.winProbability)}%</h2>
          </div>
          <ChartNoAxesCombined />
        </div>
        <div className="win-split">
          <div>
            <span>{state.battingTeam.shortName}</span>
            <strong>{Math.round(state.winProbability)}%</strong>
          </div>
          <div className="win-track">
            <motion.i animate={{ width: `${Math.round(state.winProbability)}%` }} />
          </div>
          <div>
            <span>{state.bowlingTeam.shortName}</span>
            <strong>{100 - Math.round(state.winProbability)}%</strong>
          </div>
        </div>
        <p>{pressureLabel(pressure)} pressure. {state.target > 0 ? `${state.battingTeam.shortName} need ${runsNeeded} from ${ballsLeft}.` : statsText}</p>
      </div>

      <div className="panel score-prediction-card">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Score prediction</span>
            <h2>{state.projectedScore}</h2>
          </div>
          <Gauge />
        </div>
        <p>
          At {state.runRate.toFixed(2)} rpo, projected finish is {state.projectedScore}.{" "}
          {state.target > 0 ? `${state.battingTeam.shortName} need ${runsNeeded} from ${ballsLeft}. Required rate is ${state.requiredRunRate.toFixed(2)}.` : "Target will appear in chase mode."}
        </p>
        <div className="score-projection-chart">
          <ResponsiveContainer width="100%" height={112}>
            <AreaChart data={projectionData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#9fb4ba", fontSize: 11 }} />
              <YAxis hide domain={[0, "dataMax + 10"]} />
              <Tooltip contentStyle={{ background: "#071018", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="score" stroke="#29f2c2" fill="#29f2c2" fillOpacity={0.22} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="prediction-metrics">
          <Metric label="To win" value={state.target > 0 ? `${runsNeeded}/${ballsLeft}` : "N/A"} />
          <Metric label="Run rate" value={state.runRate.toFixed(2)} />
          <Metric label="Req rate" value={state.requiredRunRate > 0 ? state.requiredRunRate.toFixed(2) : "N/A"} />
        </div>
      </div>

      <div className="panel fan-battle-widget">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Fans Battle meter</span>
            <h2>{fanBattle ? `${fanBattle.winner} won` : "Awaiting roar"}</h2>
          </div>
          <Radio />
        </div>
        <div className="fan-battle-bars">
          <div>
            <span>{fanBattle?.battingTeam ?? state.battingTeam.shortName}</span>
            <strong>{fanBattle?.battingScore ?? 0}</strong>
            <i style={{ width: `${fanBattle?.battingScore ?? 8}%` }} />
          </div>
          <div className="away">
            <span>{fanBattle?.bowlingTeam ?? state.bowlingTeam.shortName}</span>
            <strong>{fanBattle?.bowlingScore ?? 0}</strong>
            <i style={{ width: `${fanBattle?.bowlingScore ?? 8}%` }} />
          </div>
        </div>
        <p>{fanBattle ? `Latest crowd battle captured at ${new Date(fanBattle.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : "Dugout.AI will store the latest cheer winner after the next Fans Battle."}</p>
      </div>

      <AskGeminiPanel snapshot={snapshot} />
      <InsightCard icon={<Gauge />} title="Your Score" text={`${fanScore} points. Current streak: ${streak}. ${selectedNote}`} />
      <InsightCard icon={<Sparkles />} title="Strategy Agent" text={strategy?.text ?? "Tactical advice will appear after the next trigger."} />
      <InsightCard icon={<Activity />} title="Crowd Pulse" text={sentiment?.text ?? `${Math.round(state.winProbability)}% fan belief for ${state.battingTeam.shortName}. Noise level ${Math.round(state.crowdEnergy)}%.`} />
      <InsightCard icon={<ChartNoAxesCombined />} title="Stats Lens" text={chartData.length ? statsText : "Momentum timeline starts after the first reveal."} />
    </section>
  );
}

function InsightCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <motion.article className="panel insight-card" whileHover={{ y: -4 }}>
      <div className="insight-title">
        {icon}
        <strong>{title}</strong>
      </div>
      <p>{text}</p>
    </motion.article>
  );
}

function AgentMiniRail({ activities }: { activities: AgentActivity[] }) {
  const agentIds = ["hype_commentary", "analyst_commentary", "prediction", "strategy", "sentiment"];

  return (
    <section className="panel mini-agent-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">AI crew</span>
          <h2>Who is working?</h2>
        </div>
        <Brain className="pulse-icon" />
      </div>
      <div className="mini-agent-list">
        {agentIds.map((agentId) => {
          const activity = activities.find((item) => item.agentId === agentId);
          return (
            <motion.div
              key={agentId}
              className={`mini-agent ${activity?.status ?? "idle"}`}
              layout
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span />
              <strong>{activity?.status ?? "idle"}</strong>
              <p>{activity?.label ?? agentId.replace("_", " ")}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function ScorecardPanel({ matchState }: { matchState: MatchState }) {
  const scorecard = matchState.scorecard;

  if (!scorecard) {
    return (
      <section className="panel timeline-panel scorecard-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Live scorecard</span>
            <h2>Scorecard loading</h2>
          </div>
          <span className="over-chip">API</span>
        </div>
        <p className="muted-copy">The scorecard appears when the selected match API returns batting and bowling cards.</p>
      </section>
    );
  }

  const defendingTotal = matchState.target > 0 ? matchState.target - 1 : null;
  const ballsUsed = legalBallsFromOvers(matchState.overs);
  const inningsBalls = matchState.matchId.includes("super-over") ? 6 : 36;
  const battingProgress = matchState.target > 0 ? Math.min(100, Math.round((matchState.score / matchState.target) * 100)) : Math.min(100, Math.round((ballsUsed / inningsBalls) * 100));

  return (
    <section className="panel timeline-panel scorecard-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Live scorecard</span>
          <h2>Team cards</h2>
        </div>
        <span className="over-chip">{matchState.score}/{matchState.wickets}</span>
      </div>
      <div className="team-score-compare">
        <article className="team-score-card active rcb-card">
          <span>{matchState.battingTeam.shortName}</span>
          <strong>{matchState.score}/{matchState.wickets}</strong>
          <p>{matchState.overs} overs · RPO {matchState.runRate.toFixed(2)}</p>
          <div className="team-progress"><i style={{ width: `${battingProgress}%` }} /></div>
        </article>
        <article className="team-score-card csk-card">
          <span>{matchState.bowlingTeam.shortName}</span>
          <strong>{defendingTotal !== null ? defendingTotal : "Yet to bat"}</strong>
          <p>{matchState.target > 0 ? `Target ${matchState.target}` : "Bowling card active"}</p>
          <div className="team-progress defending"><i style={{ width: "100%" }} /></div>
        </article>
      </div>
      {matchState.matchId.includes("super-over") && (
        <div className="tie-score-strip">
          <span>Main match tied</span>
          <strong>RCB 191/6</strong>
          <strong>CSK 191/7</strong>
        </div>
      )}
      <div className="scorecard-table">
        <div className="scorecard-row scorecard-head-row">
          <span>Batter</span>
          <span>R</span>
          <span>B</span>
          <span>4s</span>
          <span>6s</span>
          <span>SR</span>
        </div>
        {scorecard.batters.map((batter) => (
          <div key={`${batter.name}-${batter.status}`} className={`scorecard-row ${batter.onCrease ? "on-crease" : ""}`}>
            <span>
              <strong>{batter.name}</strong>
              <em>{batter.onCrease ? "batting" : batter.status}</em>
            </span>
            <span>{batter.runs}</span>
            <span>{batter.balls}</span>
            <span>{batter.fours}</span>
            <span>{batter.sixes}</span>
            <span>{batter.strikeRate}</span>
          </div>
        ))}
      </div>
      <div className="scorecard-meta-grid">
        <div>
          <span>Extras</span>
          <strong>{scorecard.extras.total}</strong>
          <p>Wd {scorecard.extras.wides} · NB {scorecard.extras.noBalls} · B {scorecard.extras.byes} · LB {scorecard.extras.legByes}</p>
        </div>
        <div>
          <span>Partnership</span>
          <strong>{scorecard.partnership ?? "Awaiting data"}</strong>
          <p>{scorecard.status ?? "Live scorecard update"}</p>
        </div>
      </div>
      {scorecard.oppositionBatting && (
        <div className="opposition-innings-card">
          <div className="scorecard-section-title">
            <span>{scorecard.oppositionBatting.team}</span>
            <strong>{scorecard.oppositionBatting.score}/{scorecard.oppositionBatting.wickets} in {scorecard.oppositionBatting.overs}</strong>
          </div>
          <div className="scorecard-table compact-scorecard">
            <div className="scorecard-row scorecard-head-row">
              <span>Batter</span>
              <span>R</span>
              <span>B</span>
              <span>4s</span>
              <span>6s</span>
              <span>SR</span>
            </div>
            {scorecard.oppositionBatting.batters.map((batter) => (
              <div key={`${scorecard.oppositionBatting?.team}-${batter.name}`} className="scorecard-row">
                <span>
                  <strong>{batter.name}</strong>
                  <em>{batter.status}</em>
                </span>
                <span>{batter.runs}</span>
                <span>{batter.balls}</span>
                <span>{batter.fours}</span>
                <span>{batter.sixes}</span>
                <span>{batter.strikeRate}</span>
              </div>
            ))}
          </div>
          <p className="scorecard-note">
            Extras {scorecard.oppositionBatting.extras.total} · {scorecard.oppositionBatting.status ?? "First innings complete."}
          </p>
        </div>
      )}
      <div className="scorecard-table bowler-card">
        <div className="scorecard-row scorecard-head-row">
          <span>Bowler</span>
          <span>O</span>
          <span>M</span>
          <span>R</span>
          <span>W</span>
          <span>Econ</span>
        </div>
        {scorecard.bowlers.slice().reverse().map((bowler) => (
          <div key={bowler.name} className={`scorecard-row ${bowler.name === matchState.bowler ? "on-crease" : ""}`}>
            <span>
              <strong>{bowler.name}</strong>
              <em>{bowler.name === matchState.bowler ? "current spell" : scorecard.bowlingTeam}</em>
            </span>
            <span>{bowler.overs}</span>
            <span>{bowler.maidens}</span>
            <span>{bowler.runs}</span>
            <span>{bowler.wickets}</span>
            <span>{bowler.economy}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StadiumFeelPanel({ matchState, latestBall, selectedSide }: { matchState: MatchState; latestBall: BallEvent | null; selectedSide: string | null }) {
  const pressure = pressureValue(matchState);
  const battingBelief = Math.max(5, Math.min(95, Math.round(matchState.winProbability)));
  const bowlingBelief = 100 - battingBelief;
  return (
    <section className="panel stadium-panel">
      <div className="stadium-sky">
        <span className="panel-kicker">Crowd pulse</span>
        <h2>{selectedSide ? `${selectedSide} fan energy` : "Pick a side"}</h2>
      </div>
      <div className="stadium-meter">
        <div className="noise-bars">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index} style={{ height: `${18 + ((matchState.crowdEnergy + index * 7) % 44)}px` }} />
          ))}
        </div>
        <div className="momentum-arc" style={{ "--meter": `${matchState.momentum}%` } as React.CSSProperties}>
          <strong>{pressure}%</strong>
          <span>Pressure</span>
        </div>
      </div>
      <div className="belief-split">
        <span>{matchState.battingTeam.shortName} {battingBelief}%</span>
        <div><i style={{ width: `${battingBelief}%` }} /></div>
        <span>{matchState.bowlingTeam.shortName} {bowlingBelief}%</span>
      </div>
      <p className="pulse-copy">
        {latestBall ? latestBall.commentarySeed : "The crowd is waiting for the first ball reveal."}
      </p>
    </section>
  );
}

function AskGeminiPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  type ChatMessage = {
    id: string;
    role: "user" | "gemini";
    text: string;
  };
  const [question, setQuestion] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "gemini",
      text: "Ask about the chase, pressure, win chance, best strategy, or the last ball."
    }
  ]);
  const [loading, setLoading] = React.useState(false);
  const canAsk = Boolean(question.trim()) && !loading;

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed
    };
    setMessages((current) => [...current, userMessage].slice(-8));
    setQuestion("");
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/ask-gemini`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed })
      });
      const payload = (await response.json()) as { ok: boolean; answer?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Gemini could not answer right now.");
      }
      const geminiMessage: ChatMessage = {
        id: `gemini-${Date.now()}`,
        role: "gemini",
        text: payload.answer || "No answer returned."
      };
      setMessages((current) => [
        ...current,
        geminiMessage
      ].slice(-8));
    } catch (askError) {
      const errorMessage: ChatMessage = {
        id: `gemini-error-${Date.now()}`,
        role: "gemini",
        text: askError instanceof Error ? askError.message : "Gemini could not answer right now."
      };
      setMessages((current) => [
        ...current,
        errorMessage
      ].slice(-8));
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = [
    "Who is under more pressure?",
    "What should the bowler try now?",
    "Can this team still win?"
  ];

  return (
    <section className="panel ask-gemini-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Ask Gemini</span>
          <h2>Match Q&A</h2>
        </div>
        <Sparkles />
      </div>
      <div className="ask-gemini-body">
        <div className="ask-chat-list">
          <span>{snapshot.source === "demo" ? "Demo context" : "Live context"}</span>
          {messages.map((message) => (
            <div key={message.id} className={`ask-message ${message.role}`}>
              <strong>{message.role === "user" ? "You" : "Gemini"}</strong>
              <p>{message.text}</p>
            </div>
          ))}
          {loading && (
            <div className="ask-message gemini typing">
              <strong>Gemini</strong>
              <p>Reading the match...</p>
            </div>
          )}
        </div>
        <div className="ask-gemini-form">
          <textarea
            value={question}
            maxLength={500}
            placeholder="Ask a match question..."
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask();
              }
            }}
          />
          <button disabled={!canAsk} onClick={() => void ask()}>
            <Brain size={16} />
            {loading ? "Asking" : "Ask"}
          </button>
        </div>
        <div className="ask-samples">
          {sampleQuestions.map((sample) => (
            <button key={sample} onClick={() => setQuestion(sample)}>
              {sample}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function BroadcastControls({
  snapshot,
  voiceEnabled,
  onEnableVoice,
  onStopVoice
}: {
  snapshot: DashboardSnapshot;
  voiceEnabled: boolean;
  onEnableVoice: () => void;
  onStopVoice: () => void;
}) {
  return (
    <section className="panel broadcast-controls">
      <div className="voice-control">
        <span className="panel-kicker">Voice controls</span>
        <div className="volume-row">
          <span>Akash</span>
          <div><i /></div>
        </div>
        <div className="volume-row blue">
          <span>Alia</span>
          <div><i /></div>
        </div>
      </div>
      <div className="broadcast-mode">
        <span className="panel-kicker">Broadcast mode</span>
        <button className={voiceEnabled ? "active" : ""} onClick={voiceEnabled ? onStopVoice : onEnableVoice}>
          {voiceEnabled ? "Stop Voice" : "Enable Voice"}
        </button>
        <button>Text Only</button>
      </div>
      <div className="quick-actions">
        <span className="panel-kicker">Quick actions</span>
        <button><Share2 size={17} /> Share</button>
        <button><Expand size={17} /> Full Screen</button>
        <button onClick={() => socket.emit("replay")}><RotateCcw size={17} /> Refresh</button>
      </div>
      <div className="powered-by">
        <span className="panel-kicker">Powered by</span>
        <strong>Gemini</strong>
        <strong>Google TTS</strong>
        <em>{snapshot.running ? "Live" : "Paused"}</em>
      </div>
    </section>
  );
}

function AgentRail({ activities }: { activities: AgentActivity[] }) {
  return (
    <section className="agent-rail">
      {activities.map((activity) => (
        <motion.article key={activity.agentId} className={`agent-tile ${activity.status}`} layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <span>{activity.label}</span>
          <strong>{activity.status}</strong>
          <p>{activity.detail}</p>
        </motion.article>
      ))}
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
