import type { BallEvent, MatchState, MatchSummary, TeamInfo } from "@agent11/shared";

interface CricApiScore {
  r?: number;
  w?: number;
  o?: number;
  inning?: string;
}

interface CricApiMatch {
  id: string;
  name?: string;
  status?: string;
  venue?: string;
  dateTimeGMT?: string;
  series?: string;
  teams?: string[];
  teamInfo?: Array<{ name?: string; shortname?: string; img?: string }>;
  score?: CricApiScore[];
  matchStarted?: boolean;
  matchEnded?: boolean;
}

interface CricApiCurrentMatchesResponse {
  status?: string;
  data?: CricApiMatch[];
  reason?: string;
}

export interface LiveFeedResult {
  state: MatchState | null;
  event: BallEvent | null;
  status: string;
}

const API_BASE = "https://api.cricapi.com/v1";

function colorFor(index: number) {
  return index === 0 ? "#29f2c2" : "#ffb02e";
}

function teamFromApi(match: CricApiMatch, index: number): TeamInfo {
  const teamInfo = match.teamInfo?.[index];
  const name = teamInfo?.name || match.teams?.[index] || `Team ${index + 1}`;
  return {
    key: teamInfo?.shortname || name,
    name,
    shortName: teamInfo?.shortname || name.slice(0, 3).toUpperCase(),
    color: colorFor(index)
  };
}

function activeInnings(match: CricApiMatch): CricApiScore | null {
  if (!match.score?.length) {
    return null;
  }
  return match.score[match.score.length - 1] ?? null;
}

function parseBattingTeam(match: CricApiMatch, inning?: string) {
  if (!inning) {
    return teamFromApi(match, 0);
  }
  const teamIndex = match.teams?.findIndex((team) => inning.toLowerCase().includes(team.toLowerCase())) ?? -1;
  return teamFromApi(match, teamIndex >= 0 ? teamIndex : 0);
}

function parseBowlingTeam(match: CricApiMatch, battingTeam: TeamInfo) {
  const index = match.teams?.findIndex((team) => team !== battingTeam.name) ?? 1;
  return teamFromApi(match, index >= 0 ? index : 1);
}

function calculateTarget(match: CricApiMatch) {
  if (!match.score || match.score.length < 2) {
    return 0;
  }
  return (match.score[0]?.r ?? 0) + 1;
}

function legalBalls(overs: number) {
  const whole = Math.floor(overs);
  const decimal = Math.round((overs - whole) * 10);
  return whole * 6 + decimal;
}

function toState(match: CricApiMatch): MatchState | null {
  const innings = activeInnings(match);
  if (!innings || typeof innings.r !== "number") {
    return null;
  }

  const battingTeam = parseBattingTeam(match, innings.inning);
  const bowlingTeam = parseBowlingTeam(match, battingTeam);
  const overs = innings.o ?? 0;
  const balls = Math.max(1, legalBalls(overs));
  const target = calculateTarget(match);
  const ballsLeft = Math.max(0, 120 - balls);
  const runsNeeded = target ? Math.max(0, target - innings.r) : 0;
  const runRate = Number((innings.r / (balls / 6)).toFixed(2));
  const requiredRunRate = target && ballsLeft ? Number(((runsNeeded / ballsLeft) * 6).toFixed(2)) : 0;

  return {
    matchId: match.id,
    venue: match.venue || "",
    battingTeam,
    bowlingTeam,
    score: innings.r,
    wickets: innings.w ?? 0,
    overs: String(overs),
    target,
    runRate,
    requiredRunRate,
    striker: "",
    nonStriker: "",
    bowler: "",
    recentBalls: [],
    momentum: 50,
    crowdEnergy: 50,
    winProbability: 50,
    projectedScore: Math.round(innings.r + runRate * (ballsLeft / 6)),
    phase: balls >= 96 ? "death" : balls >= 36 ? "middle" : "powerplay"
  };
}

function diffToEvent(previous: MatchState | null, current: MatchState): BallEvent | null {
  if (!previous || previous.matchId !== current.matchId) {
    return null;
  }

  const runDiff = current.score - previous.score;
  const wicketDiff = current.wickets - previous.wickets;
  if (runDiff === 0 && wicketDiff === 0 && current.overs === previous.overs) {
    return null;
  }

  const outcome =
    wicketDiff > 0 ? "wicket" : runDiff >= 6 ? "six" : runDiff === 4 ? "four" : runDiff === 3 ? "three" : runDiff === 2 ? "two" : runDiff === 1 ? "one" : "dot";
  const [overRaw, ballRaw] = current.overs.split(".");

  return {
    id: `${current.matchId}-${current.overs}-${current.score}-${current.wickets}`,
    over: Number(overRaw || 0),
    ball: Number(ballRaw || 0),
    outcome,
    runs: Math.max(0, runDiff),
    totalRuns: current.score,
    wicket: wicketDiff > 0 ? "Wicket from live score update" : undefined,
    striker: current.striker,
    nonStriker: current.nonStriker,
    bowler: current.bowler,
    commentarySeed: `${current.battingTeam.name} ${current.score}/${current.wickets} in ${current.overs} overs. Status: live API score update.`
  };
}

export class LiveCricketApi {
  private previousState: MatchState | null = null;
  private selectedMatchId: string | undefined;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly matchId: string | undefined,
    private readonly matchFilter: "ipl" | "all" = "ipl"
  ) {
    this.selectedMatchId = matchId || undefined;
  }

  setMatchId(matchId: string | undefined) {
    this.selectedMatchId = matchId || this.matchId || undefined;
    this.previousState = null;
  }

  getSelectedMatchId() {
    return this.selectedMatchId ?? null;
  }

  async listIplMatches(): Promise<{ matches: MatchSummary[]; status: string }> {
    if (!this.apiKey) {
      return {
        matches: [],
        status: "Missing CRICKET_API_KEY. Add a live cricket API key to .env."
      };
    }

    const url = new URL(`${API_BASE}/matches`);
    url.searchParams.set("apikey", this.apiKey);
    url.searchParams.set("offset", "0");

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network error";
      return {
        matches: [],
        status: `Live cricket API network error: ${message}`
      };
    }

    if (!response.ok) {
      return {
        matches: [],
        status: `Live cricket API HTTP ${response.status}`
      };
    }

    const payload = (await response.json()) as CricApiCurrentMatchesResponse;
    if (payload.status === "failure") {
      return {
        matches: [],
        status: payload.reason || "Live cricket API returned failure."
      };
    }

    const matches = (payload.data ?? [])
      .filter((match) => this.matchFilter === "all" || isIplMatch(match))
      .map(toSummary)
      .sort((a, b) => Number(b.matchStarted) - Number(a.matchStarted) || new Date(a.dateTimeGMT).getTime() - new Date(b.dateTimeGMT).getTime());

    return {
      matches,
      status: matches.length
        ? `${matches.length} ${this.matchFilter === "all" ? "cricket" : "IPL"} matches loaded.`
        : `No ${this.matchFilter === "all" ? "cricket" : "IPL"} matches returned by cricket API.`
    };
  }

  async poll(): Promise<LiveFeedResult> {
    if (!this.apiKey) {
      return {
        state: null,
        event: null,
        status: "Missing CRICKET_API_KEY. Add a live cricket API key to .env."
      };
    }

    const url = new URL(`${API_BASE}/currentMatches`);
    url.searchParams.set("apikey", this.apiKey);
    url.searchParams.set("offset", "0");

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network error";
      return {
        state: null,
        event: null,
        status: `Live cricket API network error: ${message}`
      };
    }

    if (!response.ok) {
      return {
        state: null,
        event: null,
        status: `Live cricket API HTTP ${response.status}`
      };
    }

    const payload = (await response.json()) as CricApiCurrentMatchesResponse;
    if (payload.status === "failure") {
      return {
        state: null,
        event: null,
        status: payload.reason || "Live cricket API returned failure."
      };
    }

    const matches = payload.data ?? [];
    const selected = this.selectedMatchId ? matches.find((match) => match.id === this.selectedMatchId) : undefined;

    if (!selected) {
      return {
        state: null,
        event: null,
        status: this.selectedMatchId
          ? "Selected IPL match is not present in current live score feed yet."
          : "Select an IPL match from the match screen."
      };
    }

    const state = toState(selected);
    if (!state) {
      return {
        state: null,
        event: null,
        status: `Selected match has no score yet: ${selected.name || selected.id}`
      };
    }

    const event = diffToEvent(this.previousState, state);
    if (event) {
      state.recentBalls = [...(this.previousState?.recentBalls ?? []), event].slice(-8);
      state.lastEvent = event;
    } else {
      state.recentBalls = this.previousState?.matchId === state.matchId ? this.previousState.recentBalls : [];
    }
    this.previousState = state;

    return {
      state,
      event,
      status: selected.status || selected.name || "Live match loaded."
    };
  }
}

function isIplMatch(match: CricApiMatch) {
  const haystack = [match.name, match.series, match.status, ...(match.teams ?? [])].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes("ipl") || haystack.includes("indian premier league");
}

function toSummary(match: CricApiMatch): MatchSummary {
  return {
    id: match.id,
    name: match.name || match.teams?.join(" vs ") || match.id,
    status: match.status || "",
    venue: match.venue || "",
    dateTimeGMT: match.dateTimeGMT || "",
    teams: match.teams ?? [],
    matchStarted: Boolean(match.matchStarted),
    matchEnded: Boolean(match.matchEnded),
    hasScore: Boolean(match.score?.length),
    series: match.series || ""
  };
}
