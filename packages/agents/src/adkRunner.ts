import { InMemoryRunner } from "@google/adk";
import type { AgentOutput, AgentRunInput } from "@agent11/shared";
import type { CricketAgentDefinition } from "./registry.js";

interface ParsedAgentResponse {
  text: string;
  confidence?: number;
}

const APP_NAME = "agent11_local_war_room";
const USER_ID = "local_demo";

function buildPrompt(input: AgentRunInput) {
  return JSON.stringify(
    {
      moment: input.moment,
      match: input.matchState,
      recentBalls: input.matchState.recentBalls.map((ball) => ({
        over: `${ball.over}.${ball.ball}`,
        outcome: ball.outcome,
        runs: ball.runs,
        note: ball.commentarySeed
      }))
    },
    null,
    2
  );
}

function parseResponse(raw: string): ParsedAgentResponse {
  const cleaned = raw.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as ParsedAgentResponse;
    if (parsed.text) {
      return parsed;
    }
  } catch {
    return { text: raw.trim(), confidence: 0.62 };
  }
  return { text: raw.trim(), confidence: 0.62 };
}

function currentEquation(input: AgentRunInput) {
  const match = input.matchState;
  const targetText = match.target > 0 ? `, target ${match.target}` : "";
  const needText = match.target > 0 ? `, need ${Math.max(0, match.target - match.score)}` : "";
  return `${match.battingTeam.shortName} ${match.score}/${match.wickets}, ${match.overs} overs${targetText}${needText}`;
}

function pressureEquation(input: AgentRunInput) {
  const match = input.matchState;
  if (match.target <= 0) {
    return `${match.battingTeam.shortName} ${match.score}/${match.wickets} after ${match.overs}`;
  }

  const [overRaw, ballRaw] = match.overs.split(".");
  const ballsBowled = Number(overRaw || 0) * 6 + Number(ballRaw || 0);
  const ballsLeft = Math.max(0, 36 - ballsBowled);
  const runsNeeded = Math.max(0, match.target - match.score);
  if (runsNeeded === 0) {
    return `${match.battingTeam.shortName} have chased ${match.target} with ${ballsLeft} balls left`;
  }
  return `${match.battingTeam.shortName} need ${runsNeeded} from ${ballsLeft}`;
}

function eventCall(input: AgentRunInput) {
  const match = input.matchState;
  const latest = match.lastEvent ?? match.recentBalls[match.recentBalls.length - 1];
  const batter = match.striker || latest?.striker || "the batter";
  const bowler = match.bowler || latest?.bowler || "the bowler";
  const seed = latest?.commentarySeed ?? input.moment.reason;

  if (!latest) {
    return { latest, batter, bowler, seed, equation: pressureEquation(input), isDeath: false };
  }

  const isDeath = latest.over >= 5 || input.moment.type === "death_overs";
  return { latest, batter, bowler, seed, equation: pressureEquation(input), isDeath };
}

function isSuperOver(input: AgentRunInput) {
  return input.matchState.matchId.includes("super-over");
}

function superOverFallbackText(definition: CricketAgentDefinition, input: AgentRunInput) {
  const match = input.matchState;
  const { latest, batter, bowler, seed, equation } = eventCall(input);
  const chasing = match.target > 0;
  const runsNeeded = Math.max(0, match.target - match.score);
  const pressureLine = chasing ? `${match.battingTeam.shortName} need ${runsNeeded} from this one-over shootout` : `${match.battingTeam.shortName} are building the one-over target`;

  switch (definition.id) {
    case "hype_commentary":
      if (latest?.outcome === "six") {
        return chasing && runsNeeded === 0
          ? `SIX! Ruturaj has ended it with a golden swing. CSK win the Super Over, the yellow stand has erupted, and Dhoni is already celebrating.`
          : `Ohoho, Super Over ka sabse bada shot! ${batter} ne pressure ko seedha stands mein bhej diya. ${equation}, aur stadium ka roof hil raha hai.`;
      }
      if (latest?.outcome === "four") {
        return `Boundary in the Super Over! ${batter} ne gap nahi, poora darwaza khol diya. ${equation}, crowd ka volume red zone mein hai.`;
      }
      if (latest?.outcome === "wicket") {
        return `WICKET! ${bowler} ne Super Over ka script phaad diya. ${seed} ${equation}, aur ab dono dugouts mein heartbeat sunai de rahi hai.`;
      }
      if (latest?.outcome === "noBall") {
        return `No ball drama! Ye sirf extra run nahi, ye extra zindagi hai. ${equation}, aur pressure ab bowler ke kandhe par double ho gaya.`;
      }
      if (latest?.outcome === "two") {
        return `Do bhaage, jaan laga ke bhaage! ${batter} ne scoreboard ko zinda rakha. ${pressureLine}.`;
      }
      return `${seed} ${equation}. Super Over mein har run ka sound alag hota hai, aur ye stadium ab bilkul locked in hai.`;
    case "analyst_commentary":
      if (latest?.outcome === "six" || latest?.outcome === "four") {
        return `${batter} ne length early read ki aur high-pressure ball ko scoring option bana diya. ${equation}; ${bowler} ko ab pace-off ya wide line immediately switch karni hogi.`;
      }
      if (latest?.outcome === "wicket") {
        return `Ye pure pressure execution tha. ${bowler} ne batter ko high-risk option par force kiya, aur wicket ne Super Over ka win model instantly flip kar diya.`;
      }
      if (latest?.outcome === "noBall") {
        return `No-ball ka impact massive hai: runs bhi aaye, legal ball bhi repeat hogi. Fielding side ko ab damage control, wide yorker, aur deep-side protection chahiye.`;
      }
      return `${equation}. Super Over mein safe cricket ka matlab single nahi, right matchup ko strike dena hai. Next ball par field aur pace dono decisive honge.`;
    case "prediction":
      return chasing
        ? `Win pulse ${match.battingTeam.shortName} ke liye ${Math.round(match.winProbability)}% hai. ${match.battingTeam.shortName} need ${runsNeeded}, but one boundary can turn the whole stadium yellow.`
        : `Projected Super Over total ${match.projectedScore}. Agar ${match.battingTeam.shortName} 18 ke aas-paas pahunchte hain, chase pure nerve test ban jayega.`;
    case "strategy":
      return chasing
        ? `${bowler} ko body line aur wide yorker mix karna hoga. ${batter} ko straight swing mat do, aur Dhoni ko non-striker end par lock karne ki koshish karo.`
        : `${bowler} ko ${batter} ke hitting arc se ball bahar rakhni hogi. RCB ke liye target simple hai: boundary ya two, dot bilkul nahi.`;
    case "sentiment":
      return `Crowd pulse ${Math.round(match.crowdEnergy)}% hai, lekin Super Over mein number se zyada roar matter karta hai. ${match.battingTeam.shortName} fans ab har ball par stadium chala rahe hain.`;
    default:
      return currentEquation(input);
  }
}

function wantsEnglishCommentary() {
  return process.env.COMMENTARY_LANGUAGE === "english";
}

function englishFallbackText(definition: CricketAgentDefinition, input: AgentRunInput) {
  const match = input.matchState;
  const { latest, batter, bowler, seed, equation, isDeath } = eventCall(input);

  switch (definition.id) {
    case "hype_commentary":
      if (latest?.outcome === "six") {
        return isDeath
          ? `Into the night sky! ${batter} has launched it when the chase was gasping. ${equation}, and this stadium has exploded.`
          : `That is a thunderous hit from ${batter}. ${seed} ${equation}, and the whole chase has a pulse now.`;
      }
      if (latest?.outcome === "wicket") {
        return isDeath
          ? `Oh, that is ice cold from ${bowler}! A wicket in the pressure over, ${equation}. The game has turned again.`
          : `Huge breakthrough! ${bowler} has ripped the rhythm away, ${equation}. You can feel the pressure snap back.`;
      }
      if (latest?.outcome === "four") {
        return match.target > 0 && Math.max(0, match.target - match.score) === 0
          ? `There it is! ${batter} has found the rope, and ${match.battingTeam.shortName} have stolen this thriller. What a finish.`
          : `Cracked away! ${batter} finds the gap, ${equation}. That boundary changes the sound of this ground.`;
      }
      if (latest?.outcome === "dot") {
        return `Dot ball, and listen to that reaction. ${bowler} has bought precious pressure, ${equation}.`;
      }
      return `${seed} ${equation}. Every ball is starting to feel like a mini-final.`;
    case "analyst_commentary":
      if (latest?.outcome === "six" || latest?.outcome === "four") {
        return `${batter} picked the length early there. ${equation}; the bowler now has to change pace or protect the shorter side.`;
      }
      if (latest?.outcome === "wicket") {
        return `That wicket is about execution under pressure. ${bowler} attacked the high-risk option, and now ${equation}.`;
      }
      return `${equation}. The smart play is simple now: deny dots, keep the hitter on strike, and force the bowler to miss first.`;
    case "prediction":
      return `Win pulse is ${Math.round(match.winProbability)}% for ${match.battingTeam.shortName}, but ${equation}; one clean strike still flips the room.`;
    case "strategy":
      return `${bowler} should go wide yorker with third and deep cover protected. Make ${batter} manufacture power instead of swinging through the line.`;
    case "sentiment":
      return `Crowd energy is at ${Math.round(match.crowdEnergy)}%, and every fan reaction is moving with the equation: ${equation}.`;
    default:
      return currentEquation(input);
  }
}

function localFallbackText(definition: CricketAgentDefinition, input: AgentRunInput) {
  if (isSuperOver(input)) {
    return superOverFallbackText(definition, input);
  }

  if (wantsEnglishCommentary()) {
    return englishFallbackText(definition, input);
  }

  const match = input.matchState;
  const { latest, batter, bowler, seed, equation, isDeath } = eventCall(input);

  switch (definition.id) {
    case "hype_commentary":
      if (latest?.outcome === "six") {
        return isDeath
          ? `Ohoho, ye gaya crowd ke beech! ${batter} ne pressure mein chhakka jada hai. ${equation}, aur stadium bilkul phat pada hai!`
          : `Arre wah, kya strike hai! ${batter} ne ball ko utha diya, ${equation}. Ab chase mein jaan aa gayi hai.`;
      }
      if (latest?.outcome === "wicket") {
        return isDeath
          ? `Drama! ${bowler} ne final phase mein wicket nikaal diya. ${equation}. Ab har saans heavy lag rahi hai.`
          : `Bada jhatka! ${bowler} ne rhythm tod di, ${equation}. Pressure ekdum wapas aa gaya hai.`;
      }
      if (latest?.outcome === "four") {
        return match.target > 0 && Math.max(0, match.target - match.score) === 0
          ? `Bas, khatam! ${batter} ne gap nikaal diya aur ${match.battingTeam.shortName} ne thriller chura liya. Kya finish hai!`
          : `Boundary! ${batter} ne gap cheer diya, ${equation}. Crowd ka volume seedha upar chala gaya.`;
      }
      if (latest?.outcome === "dot") {
        return `Dot ball! ${bowler} ne pressure ka screw tight kar diya. ${equation}; ab next ball bahut badi hai.`;
      }
      return `${seed} ${equation}. Ab har ball mini-final jaisi feel ho rahi hai.`;
    case "analyst_commentary":
      if (latest?.outcome === "six" || latest?.outcome === "four") {
        return `${batter} ne length jaldi pick ki. ${equation}; bowler ko ab pace change ya wide line use karni hogi.`;
      }
      if (latest?.outcome === "wicket") {
        return `Ye wicket execution ka result hai. ${bowler} ne risk zone attack kiya, aur ab equation hai: ${equation}.`;
      }
      return `${equation}. Yahan smart cricket chahiye: dot avoid karo, strike rotate karo, aur loose ball ko punish karo.`;
    case "prediction":
      return `Win pulse ${match.battingTeam.shortName} ke liye ${Math.round(match.winProbability)}% hai, lekin ${equation}; ek clean hit poora mood badal sakta hai.`;
    case "strategy":
      return `${bowler} ko wide yorker jaana chahiye, third aur deep cover protect karke. ${batter} ko line ke through swing karne mat do.`;
    case "sentiment":
      return `Crowd energy ${Math.round(match.crowdEnergy)}% par hai, aur har fan ka reaction ab isi equation ke saath hil raha hai: ${equation}.`;
    default:
      return currentEquation(input);
  }
}

async function runAdkTextAgent(definition: CricketAgentDefinition, input: AgentRunInput, model: string) {
  const agent = definition.createAgent(model);
  const runner = new InMemoryRunner({ agent, appName: APP_NAME });
  const session = await runner.sessionService.createSession({ appName: APP_NAME, userId: USER_ID });
  let text = "";
  const run = runner.runAsync({
    userId: USER_ID,
    sessionId: session.id,
    newMessage: {
      role: "user",
      parts: [{ text: buildPrompt(input) }]
    },
    runConfig: {
      maxLlmCalls: 1
    }
  });

  for await (const event of run) {
    const eventText = event.content?.parts
      ?.map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (eventText) {
      text = eventText;
    }
  }

  return parseResponse(text || definition.unavailable);
}

export async function runCricketAgent(definition: CricketAgentDefinition, input: AgentRunInput): Promise<AgentOutput> {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const isDemoMatch = input.matchState.matchId.startsWith("demo-");

  const response = hasApiKey && !isDemoMatch
    ? await runAdkTextAgent(definition, input, model).catch(() => ({
        text: localFallbackText(definition, input),
        confidence: 0.58
      }))
    : { text: localFallbackText(definition, input), confidence: 0.58 };
  const text = !response.text || response.text === definition.unavailable ? localFallbackText(definition, input) : response.text;

  return {
    id: `${definition.id}-${input.moment.id}-${Date.now()}`,
    agentId: definition.id,
    label: definition.label,
    text,
    confidence: response.confidence ?? 0.7,
    priority: definition.priority + input.moment.priority,
    speak: definition.speak,
    createdAt: Date.now()
  };
}
