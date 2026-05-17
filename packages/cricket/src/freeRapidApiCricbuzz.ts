import type { BallEvent, MatchState, MatchSummary, TeamInfo } from "@agent11/shared";
import type { LiveFeedResult } from "./liveCricketApi.js";

interface FreeCricbuzzTeam {
  teamName?: string;
  teamSName?: string;
}

interface FreeCricbuzzMatchInfo {
  matchId?: number;
  seriesId?: number;
  matchDesc?: string;
  matchFormat?: string;
  startDate?: string;
  endDate?: string;
  state?: string;
  status?: string;
  team1?: FreeCricbuzzTeam;
  team2?: FreeCricbuzzTeam;
  venueInfo?: { ground?: string; city?: string; country?: string; timezone?: string };
  seriesName?: string;
  seriesCategory?: string;
}

interface FreeCricbuzzScheduleResponse {
  response?: {
    schedules?: Array<{
      scheduleAdWrapper?: {
        date?: string;
        matchScheduleList?: Array<{
          seriesName?: string;
          seriesCategory?: string;
          matchInfo?: FreeCricbuzzMatchInfo[];
        }>;
      };
    }>;
  };
}

interface ParsedScore {
  battingName: string;
  battingShort: string;
  bowlingName: string;
  bowlingShort: string;
  score: number;
  wickets: number;
  overs: string;
  target: number;
  striker: string;
  nonStriker: string;
  bowler: string;
  venue: string;
  status: string;
}

interface OfficialIplMatch {
  summary: MatchSummary;
  sourceUrl: string;
}

function cleanPath(path: string) {
  return path.replace(/^\/+/, "");
}

function team(name: string, shortName?: string, color = "#29f2c2"): TeamInfo {
  return {
    key: shortName || name,
    name,
    shortName: shortName || name.slice(0, 3).toUpperCase(),
    color
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function flattenFixtures(payload: FreeCricbuzzScheduleResponse): FreeCricbuzzMatchInfo[] {
  return (payload.response?.schedules ?? []).flatMap((schedule) =>
    (schedule.scheduleAdWrapper?.matchScheduleList ?? []).flatMap((series) =>
      (series.matchInfo ?? []).map((match) => ({
        ...match,
        seriesName: match.seriesName || series.seriesName || "",
        seriesCategory: match.seriesCategory || series.seriesCategory || ""
      }))
    )
  );
}

function isIpl(match: FreeCricbuzzMatchInfo) {
  const text = [match.seriesName, match.matchDesc, match.team1?.teamName, match.team2?.teamName, match.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes("ipl") || text.includes("indian premier league");
}

function toIsoDate(value: string | undefined) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "";
  }
  return new Date(timestamp).toISOString();
}

function toSummary(match: FreeCricbuzzMatchInfo): MatchSummary {
  const startedAt = Number(match.startDate);
  const endedAt = Number(match.endDate);
  const now = Date.now();
  const state = match.state || "";
  const status = match.status || state || "Fixture listed";
  const matchStarted = state ? !["preview", "upcoming"].includes(state.toLowerCase()) : Number.isFinite(startedAt) && startedAt <= now;
  const matchEnded = state
    ? ["complete", "completed", "stumps"].includes(state.toLowerCase())
    : Number.isFinite(endedAt) && endedAt < now;
  const venue = [match.venueInfo?.ground, match.venueInfo?.city].filter(Boolean).join(", ");

  return {
    id: String(match.matchId ?? ""),
    name: `${match.team1?.teamName ?? "TBA"} vs ${match.team2?.teamName ?? "TBA"}, ${match.matchDesc ?? match.matchFormat ?? "Match"}`,
    status,
    venue,
    dateTimeGMT: toIsoDate(match.startDate),
    teams: [match.team1?.teamName, match.team2?.teamName].filter((item): item is string => Boolean(item)),
    matchStarted,
    matchEnded,
    hasScore: matchStarted && !matchEnded,
    series: match.seriesName || ""
  };
}

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function pageText(html: string) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function pageId(prefix: "iplcom" | "cricbuzz", url: string) {
  return `${prefix}:${encodeURIComponent(url)}`;
}

function pageUrlFromId(id: string) {
  return decodeURIComponent(id.replace(/^[^:]+:/, ""));
}

function parseOfficialIplMatch(html: string, url: string): OfficialIplMatch | null {
  const text = pageText(html);
  const titleMatch = text.match(/([A-Za-z ]+?)\s+vs\s+([A-Za-z ]+?)\s+·\s+Match\s+(\d+)/i);
  const dateMatch = text.match(/([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+(?:am|pm))\s+([A-Z]{2,5})\s+vs\s+([A-Z]{2,5})\s+([^|]+? Stadium[^|]*?)(?: Weather:| Series| Venue)/i);
  const venueMatch = text.match(/Venue\s+([^|]+?,\s*India)/i);

  if (!titleMatch && !dateMatch) {
    return null;
  }

  const team1 = titleMatch?.[1]?.trim() || "Punjab Kings";
  const team2 = titleMatch?.[2]?.trim() || "Royal Challengers Bengaluru";
  const matchNumber = titleMatch?.[3] || "61";
  const dateText = dateMatch?.[1] || "May 17, 2026 3:30 pm";
  const short1 = dateMatch?.[2] || "PBKS";
  const short2 = dateMatch?.[3] || "RCB";
  const venue = venueMatch?.[1]?.trim() || dateMatch?.[4]?.trim() || "Himachal Pradesh Cricket Association Stadium, Dharamsala, India";
  const dateTimeGMT = new Date(`${dateText} GMT+0530`).toISOString();
  const now = Date.now();
  const startsAt = new Date(dateTimeGMT).getTime();

  return {
      sourceUrl: url,
      summary: {
      id: pageId("iplcom", url),
      name: `${team1} vs ${team2}, Match ${matchNumber}`,
      status: startsAt > now ? "Official IPL fixture" : "Official IPL match page",
      venue,
      dateTimeGMT,
      teams: [`${team1} (${short1})`, `${team2} (${short2})`],
      matchStarted: startsAt <= now,
      matchEnded: false,
      hasScore: false,
      series: "Indian Premier League 2026"
    }
  };
}

function parseCricbuzzMatch(html: string, url: string): OfficialIplMatch | null {
  const text = pageText(html);
  const titleMatch = text.match(/#\s*([A-Za-z ]+?)\s+vs\s+([A-Za-z ]+?),\s+(\d+)(?:st|nd|rd|th)\s+Match,\s+Indian Premier League\s+2026/i);
  const venueMatch = text.match(/Venue:\s*([^•]+?)\s*•/i);
  const timeMatch = text.match(/Date & Time:\s*Today,\s*(\d{1,2}:\d{2}\s+(?:AM|PM))\s*LOCAL/i);
  const startGmtMatch = text.match(/Match starts at\s+([A-Za-z]{3}\s+\d{1,2},\s+\d{1,2}:\d{2}\s+GMT)/i);
  const status = text.includes("Preview") ? "Cricbuzz preview - live score pending" : "Cricbuzz live match page";

  if (!titleMatch) {
    return null;
  }

  const team1 = titleMatch[1].trim();
  const team2 = titleMatch[2].trim();
  const matchNumber = titleMatch[3];
  const dateTimeGMT = startGmtMatch ? new Date(`${startGmtMatch[1]} 2026`).toISOString() : new Date(`May 17, 2026 ${timeMatch?.[1] ?? "3:30 PM"} GMT+0530`).toISOString();
  const startsAt = new Date(dateTimeGMT).getTime();

  return {
    sourceUrl: url,
    summary: {
      id: pageId("cricbuzz", url),
      name: `${team1} vs ${team2}, Match ${matchNumber}`,
      status,
      venue: venueMatch?.[1]?.trim() || "Himachal Pradesh Cricket Association Stadium, Dharamsala",
      dateTimeGMT,
      teams: [team1, team2],
      matchStarted: startsAt <= Date.now() && !text.includes("Match starts at"),
      matchEnded: false,
      hasScore: !text.includes("Match starts at"),
      series: "Indian Premier League 2026"
    }
  };
}

function legalBalls(overs: string) {
  const [wholeRaw, ballRaw] = overs.split(".");
  return Number(wholeRaw || 0) * 6 + Number(ballRaw || 0);
}

function phaseFromOvers(overs: string): MatchState["phase"] {
  const balls = legalBalls(overs);
  if (balls >= 96) {
    return "death";
  }
  if (balls >= 36) {
    return "middle";
  }
  return "powerplay";
}

function findObjects(value: unknown, predicate: (item: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => findObjects(item, predicate));
  }

  const record = value as Record<string, unknown>;
  const nested = Object.values(record).flatMap((item) => findObjects(item, predicate));
  return predicate(record) ? [record, ...nested] : nested;
}

function parseScoreText(value: unknown): { score: number; wickets: number } | null {
  if (typeof value === "number") {
    return { score: value, wickets: 0 };
  }
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return { score: Number(match[1]), wickets: Number(match[2]) };
  }

  const score = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(score) && score > 0 ? { score, wickets: 0 } : null;
}

function nestedName(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  return asString((value as { name?: unknown }).name);
}

function parseLiveScore(payload: unknown): ParsedScore | null {
  const response = (payload as { response?: unknown })?.response ?? payload;
  const candidates = findObjects(response, (item) => {
    const keys = Object.keys(item).map((key) => key.toLowerCase());
    return keys.some((key) => key.includes("score") || key === "runs") && keys.some((key) => key.includes("over"));
  });

  for (const candidate of candidates) {
    const scoreText = candidate.score ?? candidate.runs ?? candidate.teamScore ?? candidate.batTeamScore;
    const parsedScore = parseScoreText(scoreText);
    const overs = asString(candidate.overs ?? candidate.over ?? candidate.oversPlayed);
    if (!parsedScore || !overs) {
      continue;
    }

    return {
      battingName: asString(candidate.batTeamName ?? candidate.battingTeamName ?? candidate.teamName) || "Batting Team",
      battingShort: asString(candidate.batTeamSName ?? candidate.battingTeamSName ?? candidate.teamSName) || "BAT",
      bowlingName: asString(candidate.bowlTeamName ?? candidate.bowlingTeamName) || "Bowling Team",
      bowlingShort: asString(candidate.bowlTeamSName ?? candidate.bowlingTeamSName) || "BOWL",
      score: parsedScore.score,
      wickets: asNumber(candidate.wickets ?? candidate.wkts) || parsedScore.wickets,
      overs,
      target: asNumber(candidate.target),
      striker: asString(candidate.striker ?? candidate.currentBatsman) || nestedName(candidate.batsmanStriker),
      nonStriker: asString(candidate.nonStriker) || nestedName(candidate.batsmanNonStriker),
      bowler: asString(candidate.bowler) || nestedName(candidate.currentBowler),
      venue: asString(candidate.venue ?? candidate.ground),
      status: asString(candidate.status ?? candidate.matchStatus)
    };
  }

  return null;
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

  const [overRaw, ballRaw] = current.overs.split(".");
  const outcome =
    wicketDiff > 0 ? "wicket" : runDiff >= 6 ? "six" : runDiff === 4 ? "four" : runDiff === 3 ? "three" : runDiff === 2 ? "two" : runDiff === 1 ? "one" : "dot";

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
    commentarySeed: `${current.battingTeam.name} ${current.score}/${current.wickets} in ${current.overs} overs from Free Cricbuzz live score.`
  };
}

export class FreeRapidApiCricbuzz {
  private previousState: MatchState | null = null;
  private selectedMatchId: string | undefined;
  private matchListCache: { createdAt: number; matches: MatchSummary[]; status: string } | null = null;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly host: string | undefined,
    matchId: string | undefined,
    private readonly matchFilter: "ipl" | "all" = "ipl",
    private readonly fixturesPath = "cricket-schedule",
    private readonly liveScorePath = "cricket-livescores?matchid={matchId}",
    private readonly matchInfoPath = "cricket-match-info?matchid={matchId}",
    private readonly featuredIplUrls = "",
    private readonly featuredCricbuzzUrls = ""
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

    const response = await fetch(`https://${this.host}/${cleanPath(path)}`, {
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": this.host
      }
    });

    if (!response.ok) {
      throw new Error(`Free Cricbuzz RapidAPI HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private matchPath(path: string) {
    if (!this.selectedMatchId) {
      return path;
    }
    return path.includes("{matchId}") ? path.replace("{matchId}", encodeURIComponent(this.selectedMatchId)) : path;
  }

  private async featuredMatches() {
    const urls = this.featuredIplUrls
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
    const cricbuzzUrls = this.featuredCricbuzzUrls
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
    if (!urls.length && !cricbuzzUrls.length) {
      return [];
    }

    const matches = await Promise.all(
      [...urls.map((url) => ({ url, parser: parseOfficialIplMatch })), ...cricbuzzUrls.map((url) => ({ url, parser: parseCricbuzzMatch }))].map(async ({ url, parser }) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            return null;
          }
          return parser(await response.text(), url);
        } catch {
          return null;
        }
      })
    );
    return matches.filter((match): match is OfficialIplMatch => Boolean(match)).map((match) => match.summary);
  }

  async listIplMatches(): Promise<{ matches: MatchSummary[]; status: string }> {
    if (this.matchListCache && Date.now() - this.matchListCache.createdAt < 60_000) {
      return {
        matches: this.matchListCache.matches,
        status: `${this.matchListCache.status} Cached for RapidAPI quota protection.`
      };
    }

    try {
      const [payload, officialMatches] = await Promise.all([this.get<FreeCricbuzzScheduleResponse>(this.fixturesPath), this.featuredMatches()]);
      const apiFixtures = flattenFixtures(payload)
        .filter((match) => Boolean(match.matchId))
        .filter((match) => this.matchFilter === "all" || isIpl(match))
        .map(toSummary)
        .sort((a, b) => new Date(a.dateTimeGMT).getTime() - new Date(b.dateTimeGMT).getTime());
      const allFixtures = [...officialMatches, ...apiFixtures.filter((match) => !officialMatches.some((official) => official.name === match.name))]
        .sort((a, b) => new Date(a.dateTimeGMT).getTime() - new Date(b.dateTimeGMT).getTime());

      const liveMatches = allFixtures.filter((match) => match.matchStarted && !match.matchEnded).slice(0, 2);
      const liveIds = new Set(liveMatches.map((match) => match.id));
      const upcomingMatches = allFixtures.filter((match) => !liveIds.has(match.id) && !match.matchEnded).slice(0, 3);
      const matches = [...liveMatches, ...upcomingMatches].slice(0, 5);
      const result = {
        matches,
        status: matches.length
          ? `${liveMatches.length} live and ${upcomingMatches.length} upcoming ${this.matchFilter === "all" ? "cricket" : "IPL"} matches loaded from Free Cricbuzz fixtures.`
          : `No ${this.matchFilter === "all" ? "cricket" : "IPL"} fixtures returned by Free Cricbuzz.`
      };
      this.matchListCache = { ...result, createdAt: Date.now() };
      return result;
    } catch (error) {
      const status = error instanceof Error ? error.message : "Free Cricbuzz fixtures request failed.";
      if (this.matchListCache) {
        return {
          matches: this.matchListCache.matches,
          status: `${status}. Showing last cached match list.`
        };
      }
      return { matches: [], status };
    }
  }

  async poll(): Promise<LiveFeedResult> {
    if (!this.selectedMatchId) {
      return {
        state: null,
        event: null,
        status: "Select a match from the match screen."
      };
    }

    if (this.selectedMatchId.startsWith("iplcom:") || this.selectedMatchId.startsWith("cricbuzz:")) {
      try {
        const url = pageUrlFromId(this.selectedMatchId);
        const response = await fetch(url);
        const html = response.ok ? await response.text() : "";
        const official = this.selectedMatchId.startsWith("cricbuzz:") ? parseCricbuzzMatch(html, url) : parseOfficialIplMatch(html, url);
        return {
          state: null,
          event: null,
          status: official
            ? `${official.summary.name}: ${official.summary.status}. Venue: ${official.summary.venue}.`
            : "Featured match page could not be read."
        };
      } catch {
        return {
          state: null,
          event: null,
          status: "Featured match page request failed."
        };
      }
    }

    try {
      const livePayload = await this.get<unknown>(this.matchPath(this.liveScorePath));
      let parsed = parseLiveScore(livePayload);

      if (!parsed && this.matchInfoPath) {
        const infoPayload = await this.get<unknown>(this.matchPath(this.matchInfoPath));
        parsed = parseLiveScore(infoPayload);
      }

      if (!parsed) {
        return {
          state: null,
          event: null,
          status: "Selected match is listed, but the Free Cricbuzz live score payload has no score yet."
        };
      }

      const balls = Math.max(1, legalBalls(parsed.overs));
      const runRate = Number((parsed.score / (balls / 6)).toFixed(2));
      const projectedScore = Math.round(parsed.score + runRate * Math.max(0, 20 - balls / 6));
      const state: MatchState = {
        matchId: this.selectedMatchId,
        venue: parsed.venue,
        battingTeam: team(parsed.battingName, parsed.battingShort),
        bowlingTeam: team(parsed.bowlingName, parsed.bowlingShort, "#ffb02e"),
        score: parsed.score,
        wickets: parsed.wickets,
        overs: parsed.overs,
        target: parsed.target,
        runRate,
        requiredRunRate: 0,
        striker: parsed.striker,
        nonStriker: parsed.nonStriker,
        bowler: parsed.bowler,
        recentBalls: this.previousState?.recentBalls ?? [],
        momentum: 50,
        crowdEnergy: 50,
        winProbability: 50,
        projectedScore,
        phase: phaseFromOvers(parsed.overs)
      };

      const event = diffToEvent(this.previousState, state);
      if (event) {
        state.recentBalls = [...(this.previousState?.recentBalls ?? []), event].slice(-8);
        state.lastEvent = event;
      }
      this.previousState = state;

      return {
        state,
        event,
        status: parsed.status || "Free Cricbuzz live score loaded."
      };
    } catch (error) {
      return {
        state: null,
        event: null,
        status: error instanceof Error ? error.message : "Free Cricbuzz live score request failed."
      };
    }
  }
}
