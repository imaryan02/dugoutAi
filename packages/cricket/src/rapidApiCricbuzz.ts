import type { BallEvent, MatchState, MatchSummary, ScorecardSummary, TeamInfo } from "@agent11/shared";
import type { LiveFeedResult } from "./liveCricketApi.js";

interface CricbuzzMatchInfo {
  matchId: number;
  seriesId: number;
  seriesName: string;
  matchDesc: string;
  matchFormat: string;
  startDate: string;
  endDate: string;
  state: string;
  status: string;
  team1?: { teamName?: string; teamSName?: string };
  team2?: { teamName?: string; teamSName?: string };
  venueInfo?: { ground?: string; city?: string };
}

interface CricbuzzMatchWrapper {
  matchInfo?: CricbuzzMatchInfo;
}

interface CricbuzzSeriesWrapper {
  seriesAdWrapper?: {
    seriesId?: number;
    seriesName?: string;
    matches?: CricbuzzMatchWrapper[];
  };
}

interface CricbuzzMatchesResponse {
  typeMatches?: Array<{
    matchType?: string;
    seriesMatches?: CricbuzzSeriesWrapper[];
  }>;
}

interface CricbuzzInnings {
  inningsid: number;
  batteamname?: string;
  batteamsname?: string;
  score?: number;
  wickets?: number;
  overs?: number;
  runrate?: number;
  batsman?: Array<{ name?: string; runs?: number; balls?: number; fours?: number; sixes?: number; strkrate?: string; outdec?: string }>;
  bowler?: Array<{ name?: string; overs?: number | string; maidens?: number; wickets?: number; runs?: number; economy?: string }>;
  extras?: { total?: number; wides?: number; noballs?: number; byes?: number; legbyes?: number };
  partnership?: { partnership?: Array<{ bat1name?: string; bat1runs?: number; bat1balls?: number; bat2name?: string; bat2runs?: number; bat2balls?: number; totalruns?: number; totalballs?: number }> };
}

interface CricbuzzScorecardResponse {
  scorecard?: CricbuzzInnings[];
  status?: string;
  appindex?: { seotitle?: string };
}

interface CricbuzzCommentary {
  commtxt?: string;
  timestamp?: number;
  overnum?: number;
  inningsid?: number;
  eventtype?: string;
  ballnbr?: number;
  oversep?: {
    score?: number;
    wickets?: number;
    oversummary?: string;
    batstrikername?: string;
    batnonstrikername?: string;
    bowlname?: string;
    battingteamname?: string;
  };
}

interface CricbuzzCommentaryResponse {
  comwrapper?: Array<{ commentary?: CricbuzzCommentary }>;
  winprobability?: {
    team1?: { shortname?: string; percent?: number };
    team2?: { shortname?: string; percent?: number };
  };
}

function team(name: string, shortName?: string, color = "#29f2c2"): TeamInfo {
  return {
    key: shortName || name,
    name,
    shortName: shortName || name.slice(0, 3).toUpperCase(),
    color
  };
}

function flattenMatches(response: CricbuzzMatchesResponse): CricbuzzMatchInfo[] {
  return (response.typeMatches ?? []).flatMap((typeMatch) =>
    (typeMatch.seriesMatches ?? []).flatMap((series) =>
      (series.seriesAdWrapper?.matches ?? [])
        .map((match) => match.matchInfo)
        .filter((match): match is CricbuzzMatchInfo => Boolean(match))
        .map((match) => ({
          ...match,
          seriesName: match.seriesName || series.seriesAdWrapper?.seriesName || ""
        }))
    )
  );
}

function isIpl(match: CricbuzzMatchInfo) {
  const text = [match.seriesName, match.matchDesc, match.team1?.teamName, match.team2?.teamName, match.status].filter(Boolean).join(" ").toLowerCase();
  return text.includes("ipl") || text.includes("indian premier league");
}

function toSummary(match: CricbuzzMatchInfo): MatchSummary {
  const venue = [match.venueInfo?.ground, match.venueInfo?.city].filter(Boolean).join(", ");
  return {
    id: String(match.matchId),
    name: `${match.team1?.teamName ?? "TBA"} vs ${match.team2?.teamName ?? "TBA"}, ${match.matchDesc}`,
    status: match.status || match.state,
    venue,
    dateTimeGMT: new Date(Number(match.startDate)).toISOString(),
    teams: [match.team1?.teamName, match.team2?.teamName].filter((item): item is string => Boolean(item)),
    matchStarted: !["Preview", "Upcoming"].includes(match.state),
    matchEnded: ["Complete", "Stumps"].includes(match.state),
    hasScore: match.state !== "Preview",
    series: match.seriesName
  };
}

function legalBalls(overs: number) {
  const whole = Math.floor(overs);
  const decimal = Math.round((overs - whole) * 10);
  return whole * 6 + decimal;
}

function boundaryCount(state: MatchState | null, key: "fours" | "sixes") {
  return state?.scorecard?.batters.reduce((total, batter) => total + batter[key], 0) ?? 0;
}

function extrasTotal(state: MatchState | null, key: keyof ScorecardSummary["extras"]) {
  return state?.scorecard?.extras[key] ?? 0;
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

  const foursDiff = boundaryCount(current, "fours") - boundaryCount(previous, "fours");
  const sixesDiff = boundaryCount(current, "sixes") - boundaryCount(previous, "sixes");
  const wideDiff = extrasTotal(current, "wides") - extrasTotal(previous, "wides");
  const outcome =
    wicketDiff > 0 ? "wicket" : sixesDiff > 0 ? "six" : foursDiff > 0 ? "four" : wideDiff > 0 ? "wide" : runDiff === 3 ? "three" : runDiff === 2 ? "two" : runDiff === 1 ? "one" : "dot";
  const [overRaw, ballRaw] = current.overs.split(".");

  return {
    id: `${current.matchId}-${current.overs}-${current.score}-${current.wickets}`,
    over: Number(overRaw || 0),
    ball: Number(ballRaw || 0),
    outcome,
    runs: Math.max(0, runDiff),
    totalRuns: current.score,
    wicket: wicketDiff > 0 ? "Wicket from live scorecard update" : undefined,
    striker: current.striker,
    nonStriker: current.nonStriker,
    bowler: current.bowler,
    commentarySeed: `${current.battingTeam.name} ${current.score}/${current.wickets} in ${current.overs} overs. Status: live RapidAPI Cricbuzz update.`
  };
}

function cleanCommentaryText(text: string, eventType?: string) {
  const eventWord = eventType === "FOUR" ? "FOUR" : eventType === "SIX" ? "SIX" : "";
  return text.replace(/B\d+\$/g, eventWord).replace(/\s+/g, " ").trim();
}

function outcomeFromCommentary(commentary: CricbuzzCommentary): BallEvent["outcome"] {
  const eventType = commentary.eventtype?.toUpperCase();
  const text = cleanCommentaryText(commentary.commtxt ?? "", eventType).toLowerCase();
  if (eventType === "WICKET" || text.includes(" out") || text.includes("wicket")) {
    return "wicket";
  }
  if (eventType === "SIX") {
    return "six";
  }
  if (eventType === "FOUR") {
    return "four";
  }
  if (text.includes("wide")) {
    return "wide";
  }
  if (text.includes("no ball") || text.includes("noball")) {
    return "noBall";
  }
  if (text.includes("no run")) {
    return "dot";
  }
  if (text.includes("3 runs") || text.includes("three runs")) {
    return "three";
  }
  if (text.includes("2 runs") || text.includes("two runs")) {
    return "two";
  }
  if (text.includes("1 run") || text.includes("single")) {
    return "one";
  }
  return "dot";
}

function runsFromOutcome(outcome: BallEvent["outcome"]) {
  if (outcome === "six") return 6;
  if (outcome === "four") return 4;
  if (outcome === "three") return 3;
  if (outcome === "two") return 2;
  if (outcome === "one" || outcome === "wide" || outcome === "noBall") return 1;
  return 0;
}

function splitOver(overnum?: number) {
  const value = String(overnum ?? "0");
  const [overRaw, ballRaw] = value.split(".");
  return {
    over: Number(overRaw || 0),
    ball: Number(ballRaw || 0)
  };
}

function parseCommentaryNames(text: string) {
  const match = text.match(/^(.+?)\s+to\s+(.+?),/);
  return {
    bowler: match?.[1]?.trim() ?? "",
    striker: match?.[2]?.trim() ?? ""
  };
}

function commentaryToEvent(commentary: CricbuzzCommentary, state: MatchState): BallEvent | null {
  if (!commentary.commtxt || !commentary.overnum || commentary.overnum <= 0) {
    return null;
  }
  const outcome = outcomeFromCommentary(commentary);
  const cleanText = cleanCommentaryText(commentary.commtxt, commentary.eventtype?.toUpperCase());
  const names = parseCommentaryNames(cleanText);
  const over = splitOver(commentary.overnum);
  return {
    id: `${state.matchId}-${commentary.ballnbr ?? commentary.overnum}-${commentary.timestamp ?? cleanText}`,
    ...over,
    outcome,
    runs: runsFromOutcome(outcome),
    totalRuns: state.score,
    wicket: outcome === "wicket" ? cleanText : undefined,
    striker: names.striker || state.striker,
    nonStriker: state.nonStriker,
    bowler: names.bowler || state.bowler,
    commentarySeed: cleanText
  };
}

function commentaryEvents(payload: CricbuzzCommentaryResponse | null, state: MatchState) {
  const seen = new Set<string>();
  return (payload?.comwrapper ?? [])
    .map((wrapper) => wrapper.commentary)
    .filter((commentary): commentary is CricbuzzCommentary => Boolean(commentary?.commtxt && commentary.overnum && commentary.overnum > 0))
    .map((commentary) => commentaryToEvent(commentary, state))
    .filter((event): event is BallEvent => Boolean(event))
    .filter((event) => {
      const key = `${event.over}.${event.ball}-${event.commentarySeed}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .reverse();
}

function winProbabilityFromCommentary(payload: CricbuzzCommentaryResponse | null, battingShort: string) {
  const winProbability = payload?.winprobability;
  if (!winProbability) {
    return 50;
  }
  if (winProbability.team1?.shortname === battingShort) {
    return winProbability.team1.percent ?? 50;
  }
  if (winProbability.team2?.shortname === battingShort) {
    return winProbability.team2.percent ?? 50;
  }
  return 50;
}

function scorecardFromInnings(innings: CricbuzzInnings, bowlingTeam: TeamInfo, status?: string): ScorecardSummary {
  const partnership = innings.partnership?.partnership?.[0];
  return {
    battingTeam: innings.batteamsname || innings.batteamname || "Batting Team",
    bowlingTeam: bowlingTeam.shortName,
    batters: (innings.batsman ?? []).map((batter) => ({
      name: batter.name || "Unknown",
      runs: batter.runs ?? 0,
      balls: batter.balls ?? 0,
      fours: batter.fours ?? 0,
      sixes: batter.sixes ?? 0,
      strikeRate: batter.strkrate || "0",
      status: batter.outdec || "yet to bat",
      onCrease: batter.outdec === "batting"
    })),
    bowlers: (innings.bowler ?? []).map((bowler) => ({
      name: bowler.name || "Unknown",
      overs: String(bowler.overs ?? "0"),
      maidens: bowler.maidens ?? 0,
      runs: bowler.runs ?? 0,
      wickets: bowler.wickets ?? 0,
      economy: bowler.economy || "0"
    })),
    extras: {
      total: innings.extras?.total ?? 0,
      wides: innings.extras?.wides ?? 0,
      noBalls: innings.extras?.noballs ?? 0,
      byes: innings.extras?.byes ?? 0,
      legByes: innings.extras?.legbyes ?? 0
    },
    partnership: partnership
      ? `${partnership.bat1name} ${partnership.bat1runs} (${partnership.bat1balls}) + ${partnership.bat2name} ${partnership.bat2runs} (${partnership.bat2balls}) = ${partnership.totalruns} (${partnership.totalballs})`
      : undefined,
    status
  };
}

function inferTeams(payload: CricbuzzScorecardResponse, innings: CricbuzzInnings) {
  const battingShort = innings.batteamsname || innings.batteamname || "BAT";
  const seoTeams = payload.appindex?.seotitle?.match(/-\s*([A-Z]+)\s+vs\s+([A-Z]+)\s+/);
  const teamA = seoTeams?.[1];
  const teamB = seoTeams?.[2];
  const bowlingShort = teamA && teamB ? (teamA === battingShort ? teamB : teamA) : "BOWL";
  return {
    batting: team(innings.batteamname || battingShort, battingShort),
    bowling: team(bowlingShort, bowlingShort, "#ffb02e")
  };
}

export class RapidApiCricbuzz {
  private previousState: MatchState | null = null;
  private selectedMatchId: string | undefined;
  private matchListCache: { createdAt: number; matches: MatchSummary[]; status: string } | null = null;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly host: string | undefined,
    matchId: string | undefined,
    private readonly matchFilter: "ipl" | "all" = "ipl",
    private readonly useCommentary = false
  ) {
    this.selectedMatchId = matchId || undefined;
  }

  setMatchId(matchId: string | undefined) {
    this.selectedMatchId = matchId || undefined;
    this.previousState = null;
  }

  getSelectedMatchId() {
    return this.selectedMatchId ?? null;
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.apiKey || !this.host) {
      throw new Error("Missing RAPIDAPI_KEY or RAPIDAPI_HOST.");
    }

    const response = await fetch(`https://${this.host}/${path}`, {
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": this.host
      }
    });

    if (!response.ok) {
      throw new Error(`RapidAPI Cricbuzz HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async listIplMatches(): Promise<{ matches: MatchSummary[]; status: string }> {
    if (this.matchListCache && Date.now() - this.matchListCache.createdAt < 60_000) {
      return {
        matches: this.matchListCache.matches,
        status: `${this.matchListCache.status} Cached for RapidAPI quota protection.`
      };
    }

    try {
      const [livePayload, upcomingPayload] = await Promise.all([
        this.get<CricbuzzMatchesResponse>("matches/v1/live"),
        this.get<CricbuzzMatchesResponse>("matches/v1/upcoming")
      ]);
      const filterMatch = (match: CricbuzzMatchInfo) => this.matchFilter === "all" || isIpl(match);
      const liveMatches = flattenMatches(livePayload).filter(filterMatch).map(toSummary).slice(0, 2);
      const upcomingMatches = flattenMatches(upcomingPayload).filter(filterMatch).map(toSummary).slice(0, 3);
      const matches = [...liveMatches, ...upcomingMatches];
      const result = {
        matches,
        status: matches.length
          ? `${liveMatches.length} live and ${upcomingMatches.length} upcoming ${this.matchFilter === "all" ? "cricket" : "IPL"} matches loaded.`
          : `No ${this.matchFilter === "all" ? "cricket" : "IPL"} matches returned by RapidAPI Cricbuzz.`
      };
      this.matchListCache = { ...result, createdAt: Date.now() };
      return result;
    } catch (error) {
      const status = error instanceof Error ? error.message : "RapidAPI Cricbuzz request failed.";
      if (this.matchListCache) {
        return {
          matches: this.matchListCache.matches,
          status: `${status}. Showing last cached match list.`
        };
      }
      return {
        matches: [],
        status
      };
    }
  }

  async poll(): Promise<LiveFeedResult> {
    if (!this.selectedMatchId) {
      return {
        state: null,
        event: null,
        status: "Select an IPL match from the match screen."
      };
    }

    try {
      const payload = await this.get<CricbuzzScorecardResponse>(`mcenter/v1/${this.selectedMatchId}/hscard`);
      const commentaryPayload = this.useCommentary
        ? await this.get<CricbuzzCommentaryResponse>(`mcenter/v1/${this.selectedMatchId}/comm`).catch(() => null)
        : null;
      const innings = payload.scorecard?.[payload.scorecard.length - 1];
      if (!innings || typeof innings.score !== "number") {
        return {
          state: null,
          event: null,
          status: "Selected match scorecard is not available yet."
        };
      }

      const balls = Math.max(1, legalBalls(innings.overs ?? 0));
      const runRate = Number((innings.score / (balls / 6)).toFixed(2));
      const activeBatters = (innings.batsman ?? []).filter((batter) => batter.outdec === "batting");
      const { batting, bowling } = inferTeams(payload, innings);
      const scorecard = scorecardFromInnings(innings, bowling, payload.status);
      const latestCommentary = commentaryPayload?.comwrapper
        ?.map((wrapper) => wrapper.commentary)
        .find((commentary) => commentary?.commtxt && commentary.overnum && commentary.overnum > 0);
      const latestNames = latestCommentary ? parseCommentaryNames(cleanCommentaryText(latestCommentary.commtxt ?? "", latestCommentary.eventtype)) : { bowler: "", striker: "" };
      const currentBatter =
        latestNames.striker || latestCommentary?.oversep?.batstrikername || activeBatters[0]?.name || innings.batsman?.find((batter) => (batter.balls ?? 0) > 0 && !batter.outdec)?.name || "";
      const nonStriker = activeBatters.find((batter) => batter.name && batter.name !== currentBatter)?.name || latestCommentary?.oversep?.batnonstrikername || activeBatters[1]?.name || "";
      const currentBowler = latestNames.bowler || latestCommentary?.oversep?.bowlname || innings.bowler?.[innings.bowler.length - 1]?.name || "";
      const winProbability = winProbabilityFromCommentary(commentaryPayload, batting.shortName);
      const state: MatchState = {
        matchId: this.selectedMatchId,
        venue: "",
        battingTeam: batting,
        bowlingTeam: bowling,
        score: innings.score,
        wickets: innings.wickets ?? 0,
        overs: String(innings.overs ?? 0),
        target: 0,
        runRate,
        requiredRunRate: 0,
        striker: currentBatter,
        nonStriker,
        bowler: currentBowler,
        recentBalls: this.previousState?.recentBalls ?? [],
        momentum: 50,
        crowdEnergy: 50,
        winProbability,
        projectedScore: innings.overs ? Math.round(innings.score + runRate * Math.max(0, 20 - innings.overs)) : innings.score,
        phase: balls >= 96 ? "death" : balls >= 36 ? "middle" : "powerplay",
        scorecard
      };

      const exactEvents = commentaryEvents(commentaryPayload, state);
      state.recentBalls = exactEvents.length ? exactEvents : state.recentBalls;
      const latestExactEvent = exactEvents[exactEvents.length - 1];
      const previousRecentBalls = this.previousState?.recentBalls ?? [];
      const previousLatestEventId = this.previousState?.lastEvent?.id ?? previousRecentBalls[previousRecentBalls.length - 1]?.id;
      const event = latestExactEvent && latestExactEvent.id !== previousLatestEventId ? latestExactEvent : diffToEvent(this.previousState, state);
      if (event) {
        if (!exactEvents.length) {
          state.recentBalls = [...(this.previousState?.recentBalls ?? []), event].slice(-8);
        }
        state.lastEvent = event;
      }
      this.previousState = state;

      return {
        state,
        event,
        status: "RapidAPI Cricbuzz scorecard loaded."
      };
    } catch (error) {
      return {
        state: null,
        event: null,
        status: error instanceof Error ? error.message : "RapidAPI Cricbuzz scorecard request failed."
      };
    }
  }
}
