import type { BallEvent, MatchState, MatchSummary, TeamInfo } from "@agent11/shared";
import type { LiveFeedResult } from "./liveCricketApi.js";

export const teams: Record<string, TeamInfo> = {
  TITANS: {
    key: "TITANS",
    name: "Bengaluru Titans",
    shortName: "BT",
    color: "#29f2c2"
  },
  ROYALS: {
    key: "ROYALS",
    name: "Chennai Royals",
    shortName: "CR",
    color: "#ffb02e"
  }
};

const script: Omit<BallEvent, "id" | "totalRuns">[] = [
  { over: 17, ball: 1, outcome: "one", runs: 1, striker: "Virat Rao", nonStriker: "Aman Gill", bowler: "K. Nataraj", commentarySeed: "Rao clips into the leg side and keeps strike moving." },
  { over: 17, ball: 2, outcome: "four", runs: 4, striker: "Aman Gill", nonStriker: "Virat Rao", bowler: "K. Nataraj", commentarySeed: "Gill opens the face and beats short third." },
  { over: 17, ball: 3, outcome: "dot", runs: 0, striker: "Aman Gill", nonStriker: "Virat Rao", bowler: "K. Nataraj", commentarySeed: "Perfect wide yorker, Gill cannot reach it." },
  { over: 17, ball: 4, outcome: "six", runs: 6, striker: "Aman Gill", nonStriker: "Virat Rao", bowler: "K. Nataraj", commentarySeed: "Gill launches the slower ball over deep mid-wicket." },
  { over: 17, ball: 5, outcome: "two", runs: 2, striker: "Aman Gill", nonStriker: "Virat Rao", bowler: "K. Nataraj", commentarySeed: "Hard running turns one into two." },
  { over: 17, ball: 6, outcome: "wicket", runs: 0, wicket: "Aman Gill c deep square leg", striker: "Aman Gill", nonStriker: "Virat Rao", bowler: "K. Nataraj", commentarySeed: "Gill goes again but picks out the fielder on the rope." },
  { over: 18, ball: 1, outcome: "one", runs: 1, striker: "Neel Shah", nonStriker: "Virat Rao", bowler: "R. Iyer", commentarySeed: "Shah nudges his first ball into the gap." },
  { over: 18, ball: 2, outcome: "six", runs: 6, striker: "Virat Rao", nonStriker: "Neel Shah", bowler: "R. Iyer", commentarySeed: "Rao steps across and sends the full toss into the second tier." },
  { over: 18, ball: 3, outcome: "four", runs: 4, striker: "Virat Rao", nonStriker: "Neel Shah", bowler: "R. Iyer", commentarySeed: "Rao slices behind point, the chase is alive." },
  { over: 18, ball: 4, outcome: "wide", runs: 1, striker: "Virat Rao", nonStriker: "Neel Shah", bowler: "R. Iyer", commentarySeed: "Pressure shows as Iyer sprays it beyond the tramline." },
  { over: 18, ball: 4, outcome: "dot", runs: 0, striker: "Virat Rao", nonStriker: "Neel Shah", bowler: "R. Iyer", commentarySeed: "Brilliant comeback, slower bouncer into the body." },
  { over: 18, ball: 5, outcome: "two", runs: 2, striker: "Virat Rao", nonStriker: "Neel Shah", bowler: "R. Iyer", commentarySeed: "Muscled to long-on, they sprint back for two." },
  { over: 18, ball: 6, outcome: "four", runs: 4, striker: "Virat Rao", nonStriker: "Neel Shah", bowler: "R. Iyer", commentarySeed: "Low full toss, Rao drills it straight past the bowler." },
  { over: 19, ball: 1, outcome: "wicket", runs: 0, wicket: "Virat Rao b Malik", striker: "Virat Rao", nonStriker: "Neel Shah", bowler: "Arman Malik", commentarySeed: "Malik nails the yorker and Rao is bowled." },
  { over: 19, ball: 2, outcome: "one", runs: 1, striker: "Dev Batra", nonStriker: "Neel Shah", bowler: "Arman Malik", commentarySeed: "Batra squeezes it to point." },
  { over: 19, ball: 3, outcome: "six", runs: 6, striker: "Neel Shah", nonStriker: "Dev Batra", bowler: "Arman Malik", commentarySeed: "Shah clears his front leg and sends it miles." },
  { over: 19, ball: 4, outcome: "two", runs: 2, striker: "Neel Shah", nonStriker: "Dev Batra", bowler: "Arman Malik", commentarySeed: "Driven hard to long-off, two more." },
  { over: 19, ball: 5, outcome: "four", runs: 4, striker: "Neel Shah", nonStriker: "Dev Batra", bowler: "Arman Malik", commentarySeed: "Inside edge beats the keeper, chaos at the finish." },
  { over: 19, ball: 6, outcome: "six", runs: 6, striker: "Neel Shah", nonStriker: "Dev Batra", bowler: "Arman Malik", commentarySeed: "Final ball disappears over long-on." }
];

export function buildDemoInnings(startScore = 142): BallEvent[] {
  let total = startScore;
  return script.map((ball, index) => {
    total += ball.runs;
    return {
      ...ball,
      id: `${ball.over}.${ball.ball}-${index}`,
      totalRuns: total
    };
  });
}

const demoBattingTeam: TeamInfo = {
  key: "RCB",
  name: "Royal Challengers Bengaluru",
  shortName: "RCB",
  color: "#d71920"
};

const demoBowlingTeam: TeamInfo = {
  key: "CSK",
  name: "Chennai Super Kings",
  shortName: "CSK",
  color: "#f9cd05"
};

const DEMO_MATCH_ID = "demo-six-over-thriller";
const SUPER_OVER_MATCH_ID = "demo-super-over-judges";
const DEMO_TARGET = 49;
const SUPER_OVER_TARGET = 19;

const thrillerScript: Omit<BallEvent, "id" | "totalRuns">[] = [
  { over: 0, ball: 1, outcome: "one", runs: 1, striker: "Virat Kohli", nonStriker: "Jacob Bethell", bowler: "Khaleel Ahmed", commentarySeed: "Kohli opens the chase with a sharp single into the leg side." },
  { over: 0, ball: 2, outcome: "dot", runs: 0, striker: "Jacob Bethell", nonStriker: "Virat Kohli", bowler: "Khaleel Ahmed", commentarySeed: "Khaleel angles it across Bethell and the Chinnaswamy noise dips for a second." },
  { over: 0, ball: 3, outcome: "four", runs: 4, striker: "Jacob Bethell", nonStriker: "Virat Kohli", bowler: "Khaleel Ahmed", commentarySeed: "Bethell throws his hands through cover and RCB find their first boundary." },
  { over: 0, ball: 4, outcome: "one", runs: 1, striker: "Jacob Bethell", nonStriker: "Virat Kohli", bowler: "Khaleel Ahmed", commentarySeed: "Bethell drops it in front of point and Kohli races through." },
  { over: 0, ball: 5, outcome: "dot", runs: 0, striker: "Virat Kohli", nonStriker: "Jacob Bethell", bowler: "Khaleel Ahmed", commentarySeed: "Kohli shapes for the punch but Khaleel cramps him for room." },
  { over: 0, ball: 6, outcome: "dot", runs: 0, striker: "Virat Kohli", nonStriker: "Jacob Bethell", bowler: "Khaleel Ahmed", commentarySeed: "A tight finish from Khaleel. CSK keep the powerplay bite alive." },
  { over: 1, ball: 1, outcome: "one", runs: 1, striker: "Jacob Bethell", nonStriker: "Virat Kohli", bowler: "Noor Ahmad", commentarySeed: "Bethell taps Noor into the off side and gets Kohli back on strike." },
  { over: 1, ball: 2, outcome: "two", runs: 2, striker: "Virat Kohli", nonStriker: "Jacob Bethell", bowler: "Noor Ahmad", commentarySeed: "Kohli clips with soft hands and turns one into two." },
  { over: 1, ball: 3, outcome: "dot", runs: 0, striker: "Virat Kohli", nonStriker: "Jacob Bethell", bowler: "Noor Ahmad", commentarySeed: "Noor slows it up beautifully. Kohli has to check the drive." },
  { over: 1, ball: 4, outcome: "four", runs: 4, striker: "Virat Kohli", nonStriker: "Jacob Bethell", bowler: "Noor Ahmad", commentarySeed: "Kohli picks the googly early and punches it inside-out for four." },
  { over: 1, ball: 5, outcome: "dot", runs: 0, striker: "Virat Kohli", nonStriker: "Jacob Bethell", bowler: "Noor Ahmad", commentarySeed: "Noor fires the quicker one into the pads and wins the dot." },
  { over: 1, ball: 6, outcome: "wicket", runs: 0, wicket: "Virat Kohli c Mhatre b Noor", striker: "Virat Kohli", nonStriker: "Jacob Bethell", bowler: "Noor Ahmad", commentarySeed: "Kohli goes for the release shot and Mhatre holds on near the rope. CSK explode." },
  { over: 2, ball: 1, outcome: "one", runs: 1, striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Ravindra Jadeja", commentarySeed: "Patidar gets off the mark with a calm push to long-on." },
  { over: 2, ball: 2, outcome: "one", runs: 1, striker: "Jacob Bethell", nonStriker: "Rajat Patidar", bowler: "Ravindra Jadeja", commentarySeed: "Bethell rotates strike before Jadeja can settle into that stump-to-stump rhythm." },
  { over: 2, ball: 3, outcome: "six", runs: 6, striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Ravindra Jadeja", commentarySeed: "Patidar clears the front leg and launches Jadeja into the stands." },
  { over: 2, ball: 4, outcome: "dot", runs: 0, striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Ravindra Jadeja", commentarySeed: "Jadeja drags the length back and Patidar cannot beat cover." },
  { over: 2, ball: 5, outcome: "one", runs: 1, striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Ravindra Jadeja", commentarySeed: "Patidar banks the big-ball damage and takes the single." },
  { over: 2, ball: 6, outcome: "dot", runs: 0, striker: "Jacob Bethell", nonStriker: "Rajat Patidar", bowler: "Ravindra Jadeja", commentarySeed: "Jadeja skids one through and Bethell cannot pierce the ring." },
  { over: 3, ball: 1, outcome: "four", runs: 4, striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Sam Curran", commentarySeed: "Patidar reads Curran's cutter and slices it behind point for four." },
  { over: 3, ball: 2, outcome: "one", runs: 1, striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Sam Curran", commentarySeed: "One more to deep square as RCB stay right in the chase." },
  { over: 3, ball: 3, outcome: "dot", runs: 0, striker: "Jacob Bethell", nonStriker: "Rajat Patidar", bowler: "Sam Curran", commentarySeed: "Curran takes pace off and Bethell checks the shot." },
  { over: 3, ball: 4, outcome: "one", runs: 1, striker: "Jacob Bethell", nonStriker: "Rajat Patidar", bowler: "Sam Curran", commentarySeed: "A risky single beats Dhoni's underarm flick." },
  { over: 3, ball: 5, outcome: "two", runs: 2, striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Sam Curran", commentarySeed: "Patidar places it wide of long-on and sprints back for two." },
  { over: 3, ball: 6, outcome: "one", runs: 1, striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Sam Curran", commentarySeed: "RCB finish the over with a single, but the chase is tightening." },
  { over: 4, ball: 1, outcome: "wicket", runs: 0, wicket: "Rajat Patidar b Pathirana", striker: "Rajat Patidar", nonStriker: "Jacob Bethell", bowler: "Matheesha Pathirana", commentarySeed: "Pathirana nails the slingy yorker and Patidar is bowled. CSK are roaring." },
  { over: 4, ball: 2, outcome: "one", runs: 1, striker: "Jitesh Sharma", nonStriker: "Jacob Bethell", bowler: "Matheesha Pathirana", commentarySeed: "Jitesh is away with a single behind square." },
  { over: 4, ball: 3, outcome: "dot", runs: 0, striker: "Jacob Bethell", nonStriker: "Jitesh Sharma", bowler: "Matheesha Pathirana", commentarySeed: "Bethell misses the ramp and the pressure meter spikes." },
  { over: 4, ball: 4, outcome: "four", runs: 4, striker: "Jacob Bethell", nonStriker: "Jitesh Sharma", bowler: "Matheesha Pathirana", commentarySeed: "Bethell answers with a fierce pull through mid-wicket." },
  { over: 4, ball: 5, outcome: "one", runs: 1, striker: "Jacob Bethell", nonStriker: "Jitesh Sharma", bowler: "Matheesha Pathirana", commentarySeed: "A single leaves the chase alive for the final over." },
  { over: 4, ball: 6, outcome: "one", runs: 1, striker: "Jitesh Sharma", nonStriker: "Jacob Bethell", bowler: "Matheesha Pathirana", commentarySeed: "Jitesh keeps strike. RCB need 11 from the final over." },
  { over: 5, ball: 1, outcome: "wicket", runs: 0, wicket: "Jitesh Sharma c Jadeja b Khaleel", striker: "Jitesh Sharma", nonStriker: "Jacob Bethell", bowler: "Khaleel Ahmed", commentarySeed: "Khaleel strikes first ball of the final over. CSK's yellow wall is bouncing." },
  { over: 5, ball: 2, outcome: "dot", runs: 0, striker: "Tim David", nonStriker: "Jacob Bethell", bowler: "Khaleel Ahmed", commentarySeed: "Tim David cannot get bat on ball. The chase is in the red zone." },
  { over: 5, ball: 3, outcome: "six", runs: 6, striker: "Tim David", nonStriker: "Jacob Bethell", bowler: "Khaleel Ahmed", commentarySeed: "Tim David clears the front leg and launches Khaleel over long-on." },
  { over: 5, ball: 4, outcome: "one", runs: 1, striker: "Tim David", nonStriker: "Jacob Bethell", bowler: "Khaleel Ahmed", commentarySeed: "David takes the single. Bethell gets the strike back." },
  { over: 5, ball: 5, outcome: "two", runs: 2, striker: "Jacob Bethell", nonStriker: "Tim David", bowler: "Khaleel Ahmed", commentarySeed: "Bethell squeezes it behind point and dives back for the second." },
  { over: 5, ball: 6, outcome: "four", runs: 4, striker: "Jacob Bethell", nonStriker: "Tim David", bowler: "Khaleel Ahmed", commentarySeed: "Final ball, Bethell carves it past cover. RCB win a Southern Derby thriller." }
];

type SuperInnings = "rcb" | "csk";
type SuperBall = Omit<BallEvent, "id" | "totalRuns"> & { innings: SuperInnings; legalBall: number };

const superOverScript: SuperBall[] = [
  { innings: "rcb", legalBall: 1, over: 0, ball: 1, outcome: "four", runs: 4, striker: "Virat Kohli", nonStriker: "Rajat Patidar", bowler: "Noor Ahmad", commentarySeed: "Kohli opens the Super Over like a headline shot. Soft hands, open face, four through the gap, and the red stand detonates first." },
  { innings: "rcb", legalBall: 2, over: 0, ball: 2, outcome: "six", runs: 6, striker: "Virat Kohli", nonStriker: "Rajat Patidar", bowler: "Noor Ahmad", commentarySeed: "Kohli goes upstairs! That is not just a six, that is a statement into the night. RCB are 10 from 2 and Noor is staring at a furnace." },
  { innings: "rcb", legalBall: 3, over: 0, ball: 3, outcome: "wicket", runs: 0, wicket: "Virat Kohli c Ruturaj b Noor Ahmad", striker: "Virat Kohli", nonStriker: "Rajat Patidar", bowler: "Noor Ahmad", commentarySeed: "Noor bites back! Kohli hunts one more, Ruturaj keeps his nerve under the lights, and the Super Over flips in one heartbeat." },
  { innings: "rcb", legalBall: 4, over: 0, ball: 4, outcome: "two", runs: 2, striker: "Rajat Patidar", nonStriker: "Devdutt Padikkal", bowler: "Noor Ahmad", commentarySeed: "Patidar punches into the pocket and they run like the trophy is between the wickets. Two hard-earned runs, zero time to breathe." },
  { innings: "rcb", legalBall: 4, over: 0, ball: 5, outcome: "noBall", runs: 5, striker: "Rajat Patidar", nonStriker: "Devdutt Padikkal", bowler: "Noor Ahmad", commentarySeed: "No ball and four! Noor has crossed the line, Patidar has found the rope, and the stadium scoreboard just caught fire. Five from an illegal thunderbolt." },
  { innings: "rcb", legalBall: 5, over: 0, ball: 5, outcome: "one", runs: 1, striker: "Rajat Patidar", nonStriker: "Devdutt Padikkal", bowler: "Noor Ahmad", commentarySeed: "Patidar takes the single after the no-ball storm. RCB move to 18, and every CSK fan is already doing the chase math." },
  { innings: "rcb", legalBall: 6, over: 0, ball: 6, outcome: "wicket", runs: 0, wicket: "Devdutt Padikkal st MS Dhoni b Noor Ahmad", striker: "Devdutt Padikkal", nonStriker: "Rajat Patidar", bowler: "Noor Ahmad", commentarySeed: "Dhoni's gloves flash like a camera shutter! Noor closes with a wicket, but RCB have thrown 18 on the table. CSK need 19 in one over." },
  { innings: "csk", legalBall: 1, over: 0, ball: 1, outcome: "one", runs: 1, striker: "Sanju Samson", nonStriker: "Ruturaj Gaikwad", bowler: "Bhuvneshwar Kumar", commentarySeed: "Sanju opens the chase with a sharp single. CSK need 18 from 5, Ruturaj takes guard, and the yellow wall is getting louder." },
  { innings: "csk", legalBall: 2, over: 0, ball: 2, outcome: "four", runs: 4, striker: "Ruturaj Gaikwad", nonStriker: "Sanju Samson", bowler: "Bhuvneshwar Kumar", commentarySeed: "Ruturaj paints the cover boundary! Pure timing, four more, and suddenly the chase has a heartbeat loud enough to shake the TV screen." },
  { innings: "csk", legalBall: 3, over: 0, ball: 3, outcome: "six", runs: 6, striker: "Ruturaj Gaikwad", nonStriker: "Sanju Samson", bowler: "Bhuvneshwar Kumar", commentarySeed: "Ruturaj launches the pressure into the top tier! Six into the yellow smoke, and CSK can see the finish line now." },
  { innings: "csk", legalBall: 4, over: 0, ball: 4, outcome: "wicket", runs: 0, wicket: "Ruturaj Gaikwad c Virat Kohli b Bhuvneshwar Kumar", striker: "Ruturaj Gaikwad", nonStriker: "Sanju Samson", bowler: "Bhuvneshwar Kumar", commentarySeed: "Bhuvneshwar refuses to fold! Ruturaj goes for the kill, Kohli holds it, and RCB drag this Super Over back from the cliff." },
  { innings: "csk", legalBall: 5, over: 0, ball: 5, outcome: "two", runs: 2, striker: "MS Dhoni", nonStriker: "Sanju Samson", bowler: "Bhuvneshwar Kumar", commentarySeed: "Dhoni walks in and clips it into the gap. Two hard runs, CSK still need six, and every phone in the stadium is recording now." },
  { innings: "csk", legalBall: 5, over: 0, ball: 6, outcome: "noBall", runs: 2, striker: "MS Dhoni", nonStriker: "Sanju Samson", bowler: "Bhuvneshwar Kumar", commentarySeed: "No ball and a run! Bhuvneshwar misses the line at the worst possible second. Extra ball, extra life, and the stadium turns completely yellow." },
  { innings: "csk", legalBall: 6, over: 0, ball: 6, outcome: "six", runs: 6, striker: "MS Dhoni", nonStriker: "Sanju Samson", bowler: "Bhuvneshwar Kumar", commentarySeed: "Dhoni finishes it! One clean swing, six into the night, CSK win the Super Over, and the yellow stand explodes before the ball lands." }
];

function legalBalls(event?: BallEvent) {
  if (!event) {
    return 0;
  }
  return event.over * 6 + event.ball;
}

function oversFromBalls(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function pressureFor(score: number, wickets: number, balls: number, event?: BallEvent) {
  const ballsLeft = Math.max(0, 36 - balls);
  const runsNeeded = Math.max(0, DEMO_TARGET - score);
  const equationPressure = ballsLeft ? Math.min(34, Math.max(0, runsNeeded - ballsLeft) * 3) : 0;
  const phasePressure = balls >= 30 ? 24 : balls >= 24 ? 14 : balls >= 18 ? 8 : 0;
  const clutchPressure = balls >= 30 && runsNeeded > ballsLeft ? 12 : 0;
  const eventPressure = event?.outcome === "wicket" ? 20 : event?.outcome === "dot" ? 10 : event?.outcome === "six" ? -14 : event?.outcome === "four" ? -8 : 0;
  return Math.max(16, Math.min(99, 24 + equationPressure + phasePressure + clutchPressure + wickets * 4 + eventPressure));
}

function demoScorecard(score: number, wickets: number, balls: number, latest?: BallEvent): MatchState["scorecard"] {
  return {
    battingTeam: demoBattingTeam.name,
    bowlingTeam: demoBowlingTeam.name,
    batters: [
      { name: "Virat Kohli", runs: 7, balls: 8, fours: 1, sixes: 0, strikeRate: "87.50", status: wickets >= 1 ? "c Ayush Mhatre b Noor Ahmad" : "batting", onCrease: latest?.striker === "Virat Kohli" || latest?.nonStriker === "Virat Kohli" },
      { name: "Jacob Bethell", runs: Math.min(24, Math.max(0, score - 28)), balls: Math.min(18, Math.max(1, balls - 15)), fours: score >= 4 ? 3 : 0, sixes: 0, strikeRate: "150.00", status: latest?.striker === "Jacob Bethell" || latest?.nonStriker === "Jacob Bethell" ? "batting" : "not out", onCrease: latest?.striker === "Jacob Bethell" || latest?.nonStriker === "Jacob Bethell" },
      { name: "Rajat Patidar", runs: 17, balls: 10, fours: 1, sixes: 1, strikeRate: "170.00", status: wickets >= 2 ? "b Matheesha Pathirana" : "batting", onCrease: latest?.striker === "Rajat Patidar" || latest?.nonStriker === "Rajat Patidar" },
      { name: "Jitesh Sharma", runs: 2, balls: 3, fours: 0, sixes: 0, strikeRate: "66.67", status: wickets >= 3 ? "c Ravindra Jadeja b Khaleel Ahmed" : "batting", onCrease: latest?.striker === "Jitesh Sharma" || latest?.nonStriker === "Jitesh Sharma" },
      { name: "Tim David", runs: Math.max(0, score - 45), balls: Math.max(0, balls - 32), fours: 0, sixes: score >= 45 ? 1 : 0, strikeRate: score >= 45 ? "175.00" : "0.00", status: score >= DEMO_TARGET ? "not out" : latest?.striker === "Tim David" || latest?.nonStriker === "Tim David" ? "batting" : "yet to bat", onCrease: latest?.striker === "Tim David" || latest?.nonStriker === "Tim David" },
      { name: "Romario Shepherd", runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: "0.00", status: "yet to bat", onCrease: false },
      { name: "Krunal Pandya", runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: "0.00", status: "yet to bat", onCrease: false }
    ],
    bowlers: [
      { name: "Khaleel Ahmed", overs: balls > 30 ? "2.0" : "1.0", maidens: 0, runs: balls > 30 ? 19 : 6, wickets: wickets >= 3 ? 1 : 0, economy: balls > 30 ? "9.50" : "6.00" },
      { name: "Noor Ahmad", overs: "1.0", maidens: 0, runs: 7, wickets: wickets >= 1 ? 1 : 0, economy: "7.00" },
      { name: "Ravindra Jadeja", overs: "1.0", maidens: 0, runs: 9, wickets: 0, economy: "9.00" },
      { name: "Sam Curran", overs: "1.0", maidens: 0, runs: 10, wickets: 0, economy: "10.00" },
      { name: "Matheesha Pathirana", overs: balls > 24 ? "1.0" : "0.0", maidens: 0, runs: balls > 24 ? 7 : 0, wickets: wickets >= 2 ? 1 : 0, economy: balls > 24 ? "7.00" : "0.00" }
    ],
    extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    partnership: latest?.striker === "Jacob Bethell" && latest?.nonStriker === "Tim David" ? "13* (4)" : latest ? `${latest.striker} / ${latest.nonStriker}` : "Kohli / Bethell",
    status: `CSK 48/5 in 6 overs. RCB chase ${DEMO_TARGET}.`,
    oppositionBatting: {
      team: demoBowlingTeam.name,
      score: 48,
      wickets: 5,
      overs: "6.0",
      batters: [
        { name: "Ayush Mhatre", runs: 12, balls: 8, fours: 2, sixes: 0, strikeRate: "150.00", status: "c Tim David b Bhuvneshwar Kumar", onCrease: false },
        { name: "Shaik Rasheed", runs: 5, balls: 6, fours: 0, sixes: 0, strikeRate: "83.33", status: "b Josh Hazlewood", onCrease: false },
        { name: "Sam Curran", runs: 8, balls: 6, fours: 1, sixes: 0, strikeRate: "133.33", status: "c Jitesh Sharma b Yash Dayal", onCrease: false },
        { name: "Ravindra Jadeja", runs: 9, balls: 7, fours: 1, sixes: 0, strikeRate: "128.57", status: "run out", onCrease: false },
        { name: "Dewald Brevis", runs: 10, balls: 6, fours: 0, sixes: 1, strikeRate: "166.67", status: "c Virat Kohli b Krunal Pandya", onCrease: false },
        { name: "MS Dhoni", runs: 3, balls: 3, fours: 0, sixes: 0, strikeRate: "100.00", status: "not out", onCrease: false },
        { name: "Shivam Dube", runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: "0.00", status: "not out", onCrease: false }
      ],
      extras: { total: 1, wides: 1, noBalls: 0, byes: 0, legByes: 0 },
      status: "CSK set 49 after a 6-over power chase."
    }
  };
}

function superScorecard(rcbScore: number, rcbWickets: number, cskScore: number, cskWickets: number, latest?: BallEvent): MatchState["scorecard"] {
  const cskBatting = latest && superOverScript.find((ball) => ball.commentarySeed === latest.commentarySeed)?.innings === "csk";
  return {
    battingTeam: cskBatting ? demoBowlingTeam.name : demoBattingTeam.name,
    bowlingTeam: cskBatting ? demoBattingTeam.name : demoBowlingTeam.name,
    batters: cskBatting
      ? [
          { name: "Sanju Samson", runs: cskScore >= 1 ? 1 : 0, balls: cskScore >= 1 ? 1 : 0, fours: 0, sixes: 0, strikeRate: cskScore >= 1 ? "100.00" : "0.00", status: "not out", onCrease: latest?.striker === "Sanju Samson" || latest?.nonStriker === "Sanju Samson" },
          { name: "Ruturaj Gaikwad", runs: cskScore >= 11 ? 10 : Math.max(0, cskScore - 1), balls: cskScore >= 11 ? 3 : Math.max(0, Math.min(2, cskScore > 1 ? 2 : 0)), fours: cskScore >= 5 ? 1 : 0, sixes: cskScore >= 11 ? 1 : 0, strikeRate: cskScore >= 11 ? "333.33" : "200.00", status: cskWickets >= 1 ? "c Virat Kohli b Bhuvneshwar Kumar" : "batting", onCrease: latest?.striker === "Ruturaj Gaikwad" || latest?.nonStriker === "Ruturaj Gaikwad" },
          { name: "MS Dhoni", runs: cskScore >= 21 ? 9 : cskScore >= 15 ? 3 : cskScore >= 13 ? 2 : 0, balls: cskScore >= 21 ? 3 : cskScore >= 13 ? 2 : 0, fours: 0, sixes: cskScore >= 21 ? 1 : 0, strikeRate: cskScore >= 21 ? "300.00" : cskScore >= 13 ? "150.00" : "0.00", status: "not out", onCrease: latest?.striker === "MS Dhoni" || latest?.nonStriker === "MS Dhoni" }
        ]
      : [
          { name: "Virat Kohli", runs: 10, balls: 3, fours: 1, sixes: 1, strikeRate: "333.33", status: rcbWickets >= 1 ? "c Ruturaj Gaikwad b Noor Ahmad" : "batting", onCrease: latest?.striker === "Virat Kohli" || latest?.nonStriker === "Virat Kohli" },
          { name: "Rajat Patidar", runs: 8, balls: 3, fours: 1, sixes: 0, strikeRate: "266.67", status: "not out", onCrease: latest?.striker === "Rajat Patidar" || latest?.nonStriker === "Rajat Patidar" },
          { name: "Devdutt Padikkal", runs: 0, balls: 1, fours: 0, sixes: 0, strikeRate: "0.00", status: rcbWickets >= 2 ? "st MS Dhoni b Noor Ahmad" : "batting", onCrease: latest?.striker === "Devdutt Padikkal" || latest?.nonStriker === "Devdutt Padikkal" }
        ],
    bowlers: cskBatting
      ? [{ name: "Bhuvneshwar Kumar", overs: "1.0", maidens: 0, runs: cskScore, wickets: cskWickets, economy: `${cskScore}.00` }]
      : [{ name: "Noor Ahmad", overs: "1.0", maidens: 0, runs: rcbScore, wickets: rcbWickets, economy: `${rcbScore}.00` }],
    extras: cskBatting
      ? { total: cskScore >= 16 ? 1 : 0, wides: 0, noBalls: cskScore >= 16 ? 1 : 0, byes: 0, legByes: 0 }
      : { total: rcbScore >= 17 ? 1 : 0, wides: 0, noBalls: rcbScore >= 17 ? 1 : 0, byes: 0, legByes: 0 },
    partnership: cskBatting ? "Dhoni / Sanju" : "Patidar / Padikkal",
    status: "Main match tied: RCB 191/6 and CSK 191/7. Super Over decides it.",
    oppositionBatting: {
      team: cskBatting ? demoBattingTeam.name : demoBowlingTeam.name,
      score: cskBatting ? rcbScore : cskScore,
      wickets: cskBatting ? rcbWickets : cskWickets,
      overs: "1.0",
      batters: cskBatting
        ? [
            { name: "Virat Kohli", runs: 10, balls: 3, fours: 1, sixes: 1, strikeRate: "333.33", status: "c Ruturaj Gaikwad b Noor Ahmad", onCrease: false },
            { name: "Rajat Patidar", runs: 8, balls: 3, fours: 1, sixes: 0, strikeRate: "266.67", status: "not out", onCrease: false },
            { name: "Devdutt Padikkal", runs: 0, balls: 1, fours: 0, sixes: 0, strikeRate: "0.00", status: "st MS Dhoni b Noor Ahmad", onCrease: false }
          ]
        : [
            { name: "Sanju Samson", runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: "0.00", status: "to bat", onCrease: false },
            { name: "Ruturaj Gaikwad", runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: "0.00", status: "to bat", onCrease: false },
            { name: "MS Dhoni", runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: "0.00", status: "to bat", onCrease: false }
          ],
      extras: cskBatting ? { total: 1, wides: 0, noBalls: 1, byes: 0, legByes: 0 } : { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      status: cskBatting ? "RCB set 19 in the Super Over." : "CSK waiting to chase in the Super Over."
    }
  };
}

function createDemoState(score = 0, wickets = 0, balls = 0, recentBalls: BallEvent[] = [], latest?: BallEvent): MatchState {
  const ballsForRate = Math.max(1, balls);
  const ballsLeft = Math.max(0, 36 - balls);
  const runsNeeded = Math.max(0, DEMO_TARGET - score);
  const runRate = Number((score / (ballsForRate / 6)).toFixed(2));
  const projectedScore = balls === 0 ? 0 : Math.round(score + runRate * (ballsLeft / 6));
  const requiredRunRate = ballsLeft ? Number(((runsNeeded / ballsLeft) * 6).toFixed(2)) : 0;
  const pressure = pressureFor(score, wickets, balls, latest);
  const winProbability = Math.max(4, Math.min(96, 100 - pressure + (latest?.outcome === "six" ? 12 : latest?.outcome === "four" ? 8 : 0)));

  return {
    matchId: DEMO_MATCH_ID,
    venue: "DugoutAi Demo Stadium",
    battingTeam: demoBattingTeam,
    bowlingTeam: demoBowlingTeam,
    score,
    wickets,
    overs: oversFromBalls(balls),
    target: DEMO_TARGET,
    runRate,
    requiredRunRate,
    striker: latest?.striker ?? "Virat Kohli",
    nonStriker: latest?.nonStriker ?? "Jacob Bethell",
    bowler: latest?.bowler ?? "Khaleel Ahmed",
    recentBalls,
    momentum: 100 - pressure,
    crowdEnergy: Math.max(42, Math.min(99, pressure + (latest?.outcome === "six" ? 20 : latest?.outcome === "wicket" ? 16 : 0))),
    winProbability,
    projectedScore,
    phase: balls >= 30 ? "death" : balls >= 12 ? "middle" : "powerplay",
    lastEvent: latest,
    scorecard: demoScorecard(score, wickets, balls, latest)
  };
}

function buildThrillerEvents() {
  let totalRuns = 0;
  return thrillerScript.map((ball, index): BallEvent => {
    totalRuns += ball.runs;
    return {
      ...ball,
      id: `${DEMO_MATCH_ID}-${ball.over}.${ball.ball}-${index}`,
      totalRuns
    };
  });
}

function buildSuperEvents() {
  let rcbTotal = 0;
  let cskTotal = 0;
  return superOverScript.map((ball, index): BallEvent & { innings: SuperInnings; legalBall: number } => {
    if (ball.innings === "rcb") {
      rcbTotal += ball.runs;
      return { ...ball, id: `${SUPER_OVER_MATCH_ID}-rcb-${index}`, totalRuns: rcbTotal };
    }
    cskTotal += ball.runs;
    return { ...ball, id: `${SUPER_OVER_MATCH_ID}-csk-${index}`, totalRuns: cskTotal };
  });
}

function createSuperState(events: ReturnType<typeof buildSuperEvents>, cursor: number, latest?: BallEvent): MatchState {
  const completed = events.slice(0, Math.max(0, cursor + 1));
  const rcbEvents = completed.filter((event) => event.innings === "rcb");
  const cskEvents = completed.filter((event) => event.innings === "csk");
  const cskBatting = cursor >= superOverScript.findIndex((event) => event.innings === "csk");
  const activeEvents = cskBatting ? cskEvents : rcbEvents;
  const score = activeEvents.reduce((total, event) => total + event.runs, 0);
  const wickets = activeEvents.filter((event) => event.outcome === "wicket").length;
  const legalBallsBowled = activeEvents.filter((event) => event.outcome !== "noBall" && event.outcome !== "wide").length;
  const target = cskBatting ? SUPER_OVER_TARGET : 0;
  const ballsLeft = Math.max(0, 6 - legalBallsBowled);
  const runsNeeded = target ? Math.max(0, target - score) : 0;
  const runRate = Number((score / (Math.max(1, legalBallsBowled) / 6)).toFixed(2));
  const projectedScore = legalBallsBowled === 0 ? 0 : Math.max(score, score + Math.round(runRate * (ballsLeft / 6)));
  const requiredRunRate = target && ballsLeft ? Number(((runsNeeded / ballsLeft) * 6).toFixed(2)) : 0;
  const pressure = target ? Math.max(18, Math.min(99, 34 + runsNeeded * 4 - ballsLeft * 3 + wickets * 16)) : Math.max(22, Math.min(82, 34 + score * 2 + wickets * 14));
  const rcbScore = rcbEvents.reduce((total, event) => total + event.runs, 0);
  const cskScore = cskEvents.reduce((total, event) => total + event.runs, 0);
  const rcbWickets = rcbEvents.filter((event) => event.outcome === "wicket").length;
  const cskWickets = cskEvents.filter((event) => event.outcome === "wicket").length;

  return {
    matchId: SUPER_OVER_MATCH_ID,
    venue: "DugoutAi Demo Stadium",
    battingTeam: cskBatting ? demoBowlingTeam : demoBattingTeam,
    bowlingTeam: cskBatting ? demoBattingTeam : demoBowlingTeam,
    score,
    wickets,
    overs: oversFromBalls(legalBallsBowled),
    target,
    runRate,
    requiredRunRate,
    striker: latest?.striker ?? (cskBatting ? "MS Dhoni" : "Virat Kohli"),
    nonStriker: latest?.nonStriker ?? (cskBatting ? "Sanju Samson" : "Rajat Patidar"),
    bowler: latest?.bowler ?? (cskBatting ? "Bhuvneshwar Kumar" : "Noor Ahmad"),
    recentBalls: activeEvents.slice(-8),
    momentum: 100 - pressure,
    crowdEnergy: Math.max(58, Math.min(99, pressure + (latest?.outcome === "six" ? 18 : latest?.outcome === "wicket" ? 14 : 0))),
    winProbability: cskBatting ? Math.max(4, Math.min(96, 100 - pressure + (score >= SUPER_OVER_TARGET ? 44 : 0))) : Math.max(12, Math.min(88, 42 + score * 2 - wickets * 10)),
    projectedScore,
    phase: "death",
    lastEvent: latest,
    scorecard: superScorecard(rcbScore, rcbWickets, cskScore, cskWickets, latest)
  };
}

export class DemoSixOverThriller {
  private selectedMatchId: string | undefined;
  private cursor = -1;
  private readonly events = buildThrillerEvents();
  private readonly superEvents = buildSuperEvents();

  constructor(matchId?: string) {
    this.selectedMatchId = matchId;
  }

  setMatchId(matchId: string | undefined) {
    this.selectedMatchId = matchId || DEMO_MATCH_ID;
    this.cursor = -1;
  }

  nextBallNow() {
    return this.poll();
  }

  jumpToFinalOver() {
    this.selectedMatchId = this.selectedMatchId || DEMO_MATCH_ID;
    this.cursor = this.selectedMatchId === SUPER_OVER_MATCH_ID ? 6 : 30;
  }

  getSelectedMatchId() {
    return this.selectedMatchId ?? null;
  }

  async listIplMatches(): Promise<{ matches: MatchSummary[]; status: string }> {
    return {
      matches: [
        {
          id: SUPER_OVER_MATCH_ID,
          name: "RCB vs CSK, Judge Mode Super Over",
          status: "Demo match - 14-ball Super Over with fan meters before each innings",
          venue: "DugoutAi Demo Stadium",
          dateTimeGMT: new Date().toISOString(),
          teams: [demoBattingTeam.name, demoBowlingTeam.name],
          matchStarted: true,
          matchEnded: false,
          hasScore: true,
          series: "DugoutAi Hackathon Demo"
        },
        {
          id: DEMO_MATCH_ID,
          name: "Royal Challengers Bengaluru vs Chennai Super Kings, 6-over thriller",
          status: "Demo match - scripted second-screen experience",
          venue: "DugoutAi Demo Stadium",
          dateTimeGMT: new Date().toISOString(),
          teams: [demoBattingTeam.name, demoBowlingTeam.name],
          matchStarted: true,
          matchEnded: false,
          hasScore: true,
          series: "DugoutAi Hackathon Demo"
        }
      ],
      status: "Demo mode: choose Judge Mode Super Over for a fast showcase, or run the scripted 6-over thriller. Add Cricbuzz/RapidAPI credentials in Settings for live mode."
    };
  }

  async poll(): Promise<LiveFeedResult> {
    if (!this.selectedMatchId) {
      return {
        state: null,
        event: null,
        status: "Choose Demo Match to run the scripted 6-over thriller, or connect a live API match."
      };
    }

    if (this.selectedMatchId === SUPER_OVER_MATCH_ID) {
      return this.pollSuperOver();
    }

    if (this.cursor >= this.events.length - 1) {
      const event = this.events[this.events.length - 1];
      return {
        state: createDemoState(event.totalRuns, this.wicketCountUntil(this.events.length - 1), legalBalls(event), this.events.slice(-8), event),
        event: null,
        status: "Demo complete: RCB win a last-ball Southern Derby thriller. Restart to replay the experience."
      };
    }

    this.cursor += 1;

    if (this.cursor === 0) {
      return {
        state: createDemoState(),
        event: null,
        status: "Demo match ready: RCB need 49 from 36 balls. Make your first prediction."
      };
    }

    const event = this.events[this.cursor - 1];
    const recentBalls = this.events.slice(Math.max(0, this.cursor - 8), this.cursor);
    return {
      state: createDemoState(event.totalRuns, this.wicketCountUntil(this.cursor - 1), legalBalls(event), recentBalls, event),
      event,
      status: event.commentarySeed
    };
  }

  private wicketCountUntil(index: number) {
    return this.events.slice(0, index + 1).filter((event) => event.outcome === "wicket").length;
  }

  private async pollSuperOver(): Promise<LiveFeedResult> {
    if (this.cursor >= this.superEvents.length + 1) {
      const event = this.superEvents[this.superEvents.length - 1];
      return {
        state: createSuperState(this.superEvents, this.superEvents.length - 1, event),
        event: null,
        status: "Demo complete: CSK win the Super Over 21/1 after RCB posted 18/2."
      };
    }

    this.cursor += 1;

    if (this.cursor === 0) {
      return {
        state: createSuperState(this.superEvents, -1),
        event: null,
        status: "Judge Mode ready: main match tied. Fan meter opens before RCB bat in the Super Over."
      };
    }

    if (this.cursor === 8) {
      return {
        state: createSuperState(this.superEvents, 6),
        event: null,
        status: "Innings break: RCB post 18/2. Fan meter opens before CSK chase 19."
      };
    }

    const eventIndex = this.cursor > 8 ? this.cursor - 2 : this.cursor - 1;
    const event = this.superEvents[eventIndex];
    return {
      state: createSuperState(this.superEvents, eventIndex, event),
      event,
      status: event.commentarySeed
    };
  }
}
