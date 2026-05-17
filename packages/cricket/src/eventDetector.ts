import type { BallEvent, DetectedMoment, MatchState, MomentType } from "@agent11/shared";

export function detectMoment(state: MatchState, event: BallEvent): DetectedMoment {
  let type: MomentType = "normal";
  let priority: DetectedMoment["priority"] = 1;
  let title = "Live ball";
  let reason = event.commentarySeed;

  if (event.outcome === "wicket") {
    type = "wicket";
    priority = 5;
    title = "Wicket shock";
    reason = event.wicket ?? "A wicket has fallen at a critical stage.";
  } else if (event.outcome === "six") {
    type = "six";
    priority = 5;
    title = "Massive six";
    reason = "A six in the death overs changes the equation instantly.";
  } else if (event.outcome === "four") {
    type = "boundary";
    priority = 4;
    title = "Boundary pressure";
    reason = "The batting side has found the rope under pressure.";
  } else if (state.requiredRunRate > 15) {
    type = "pressure_shift";
    priority = 3;
    title = "Chase pressure";
    reason = "Required run rate is now in high-risk territory.";
  } else if (state.phase === "death") {
    type = "death_overs";
    priority = 2;
    title = "Death overs phase";
    reason = "Every ball now has match-defining weight.";
  }

  return {
    id: `moment-${event.id}`,
    eventId: event.id,
    type,
    priority,
    title,
    reason
  };
}
