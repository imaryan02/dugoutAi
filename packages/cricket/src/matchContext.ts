import type { BallEvent, MatchState } from "@agent11/shared";
import { teams } from "./demoFeed.js";

const legalBallsBefore = (event: BallEvent) => {
  const completedOvers = event.over;
  const currentBall = event.outcome === "wide" || event.outcome === "noBall" ? Math.max(0, event.ball - 1) : event.ball;
  return completedOvers * 6 + currentBall;
};

const formatOvers = (event: BallEvent) => {
  const legal = legalBallsBefore(event);
  return `${Math.floor(legal / 6)}.${legal % 6}`;
};

export function createInitialMatchState(): MatchState {
  return {
    matchId: "agent11-demo-final",
    venue: "Neo Eden Arena",
    battingTeam: teams.TITANS,
    bowlingTeam: teams.ROYALS,
    score: 142,
    wickets: 3,
    overs: "17.0",
    target: 196,
    runRate: 8.35,
    requiredRunRate: 18,
    striker: "Virat Rao",
    nonStriker: "Aman Gill",
    bowler: "K. Nataraj",
    recentBalls: [],
    momentum: 48,
    crowdEnergy: 62,
    winProbability: 31,
    projectedScore: 184,
    phase: "death"
  };
}

export function applyBallToState(previous: MatchState, event: BallEvent): MatchState {
  const wickets = previous.wickets + (event.outcome === "wicket" ? 1 : 0);
  const overs = formatOvers(event);
  const legalBalls = Math.max(1, legalBallsBefore(event));
  const runRate = Number((event.totalRuns / (legalBalls / 6)).toFixed(2));
  const ballsLeft = Math.max(0, 120 - legalBalls);
  const runsNeeded = Math.max(0, previous.target - event.totalRuns);
  const requiredRunRate = ballsLeft === 0 ? 0 : Number(((runsNeeded / ballsLeft) * 6).toFixed(2));
  const recentBalls = [...previous.recentBalls, event].slice(-8);
  const impact = event.outcome === "six" ? 12 : event.outcome === "four" ? 8 : event.outcome === "wicket" ? -16 : event.runs - 1;
  const momentum = Math.max(5, Math.min(95, previous.momentum + impact));
  const winSwing = event.outcome === "wicket" ? -11 : event.runs >= 6 ? 12 : event.runs === 4 ? 8 : event.runs - 1;
  const winProbability = Math.max(3, Math.min(97, previous.winProbability + winSwing));

  return {
    ...previous,
    score: event.totalRuns,
    wickets,
    overs,
    runRate,
    requiredRunRate,
    striker: event.striker,
    nonStriker: event.nonStriker,
    bowler: event.bowler,
    recentBalls,
    momentum,
    crowdEnergy: Math.max(10, Math.min(99, previous.crowdEnergy + Math.abs(impact) / 1.4)),
    winProbability,
    projectedScore: Math.round(event.totalRuns + runRate * (ballsLeft / 6)),
    phase: legalBalls >= 96 ? "death" : legalBalls >= 36 ? "middle" : "powerplay",
    lastEvent: event
  };
}
