export type TeamKey = string;

export type BallOutcome =
  | "dot"
  | "one"
  | "two"
  | "three"
  | "four"
  | "six"
  | "wicket"
  | "wide"
  | "noBall";

export type MomentType =
  | "normal"
  | "boundary"
  | "six"
  | "wicket"
  | "milestone"
  | "pressure_shift"
  | "death_overs";

export type AgentId =
  | "score_fetch"
  | "match_context"
  | "event_detector"
  | "hype_commentary"
  | "analyst_commentary"
  | "prediction"
  | "strategy"
  | "sentiment"
  | "voice";

export type AgentStatus = "idle" | "thinking" | "speaking" | "done" | "error";

export interface TeamInfo {
  key: TeamKey;
  name: string;
  shortName: string;
  color: string;
}

export interface BallEvent {
  id: string;
  over: number;
  ball: number;
  outcome: BallOutcome;
  runs: number;
  totalRuns: number;
  wicket?: string;
  striker: string;
  nonStriker: string;
  bowler: string;
  commentarySeed: string;
}

export interface MatchState {
  matchId: string;
  venue: string;
  battingTeam: TeamInfo;
  bowlingTeam: TeamInfo;
  score: number;
  wickets: number;
  overs: string;
  target: number;
  runRate: number;
  requiredRunRate: number;
  striker: string;
  nonStriker: string;
  bowler: string;
  recentBalls: BallEvent[];
  momentum: number;
  crowdEnergy: number;
  winProbability: number;
  projectedScore: number;
  phase: "powerplay" | "middle" | "death";
  lastEvent?: BallEvent;
  scorecard?: ScorecardSummary;
}

export interface BatterScore {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: string;
  status: string;
  onCrease: boolean;
}

export interface BowlerScore {
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
}

export interface ScorecardSummary {
  battingTeam: string;
  bowlingTeam: string;
  batters: BatterScore[];
  bowlers: BowlerScore[];
  extras: {
    total: number;
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
  };
  partnership?: string;
  status?: string;
  oppositionBatting?: {
    team: string;
    score: number;
    wickets: number;
    overs: string;
    batters: BatterScore[];
    extras: ScorecardSummary["extras"];
    status?: string;
  };
}

export interface DetectedMoment {
  id: string;
  eventId: string;
  type: MomentType;
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  reason: string;
}

export interface AgentRunInput {
  matchState: MatchState;
  moment: DetectedMoment;
}

export interface AgentOutput {
  id: string;
  agentId: AgentId;
  label: string;
  text: string;
  confidence: number;
  priority: number;
  speak: boolean;
  createdAt: number;
  audio?: VoiceAudio;
}

export interface VoiceAudio {
  mimeType: string;
  data: string;
  voiceName: string;
}

export interface AgentActivity {
  agentId: AgentId;
  label: string;
  status: AgentStatus;
  detail: string;
  updatedAt: number;
}

export interface MatchSummary {
  id: string;
  name: string;
  status: string;
  venue: string;
  dateTimeGMT: string;
  teams: string[];
  matchStarted: boolean;
  matchEnded: boolean;
  hasScore: boolean;
  series: string;
}

export interface ServerToClientEvents {
  snapshot: (payload: DashboardSnapshot) => void;
  ball: (payload: BallEvent) => void;
  moment: (payload: DetectedMoment) => void;
  agentActivity: (payload: AgentActivity) => void;
  agentOutput: (payload: AgentOutput) => void;
}

export interface ClientToServerEvents {
  replay: () => void;
  pause: () => void;
  resume: () => void;
  nextBall: () => void;
  jumpFinalOver: () => void;
  selectMatch: (matchId: string) => void;
  fanMeterComplete: () => void;
}

export interface DashboardSnapshot {
  matchState: MatchState | null;
  moments: DetectedMoment[];
  outputs: AgentOutput[];
  activities: AgentActivity[];
  running: boolean;
  source: "live" | "demo";
  feedStatus: string;
  selectedMatchId: string | null;
  matchFilter: "ipl" | "all";
}
