import { LlmAgent } from "@google/adk";
import type { AgentId, MomentType } from "@agent11/shared";

export interface CricketAgentDefinition {
  id: AgentId;
  label: string;
  description: string;
  triggers: MomentType[];
  speak: boolean;
  priority: number;
  createAgent: (model: string) => LlmAgent;
  unavailable: string;
}

function commentaryLanguageGuide() {
  return process.env.COMMENTARY_LANGUAGE === "english"
    ? `
Language mode: English.
Write natural conversational English, like a premium live cricket broadcast.
Make Akash and Alia sound like real humans talking to fans, not a bot summary.
Use cricket words naturally: over, strike, boundary, pressure, line, length, momentum.
Prefer active, sensory phrasing: crowd noise, pressure, swing, silence, roar, release.
`
    : `
Language mode: Hindi/Hinglish.
Write conversational Hindi/Hinglish. Use simple Hindi, with common cricket English words like over, strike, boundary, pressure, line, length, momentum.
Make Akash and Alia sound like real humans in a live Indian cricket broadcast, not a bot summary.
Prefer active, sensory phrasing: crowd ka shor, pressure, swing, silence, roar, release.
`;
}

const responseContract = `
Return only compact JSON with this shape:
{"text":"one energetic live cricket commentary line under 30 words","confidence":0.0-1.0}
Do not wrap the JSON in markdown.
Do not prefix the line with your own name; the UI already shows the speaker.
No hashtags, emojis, or generic filler like "what a moment" unless tied to the ball.
`;

const contextInstruction = `
You are inside DugoutAi, a local multi-agent cricket war room.
Use the supplied match JSON only. Be specific, live, and broadcast-ready.
Avoid fake historical facts unless they are present in the supplied context.
You are speaking to Indian cricket fans. Keep the tone human, warm, immediate, and conversational.
Make every line feel like it belongs after the latest ball, not like a scoreboard summary.
`;

export const cricketAgents: CricketAgentDefinition[] = [
  {
    id: "hype_commentary",
    label: "Akash",
    description: "Male high-energy live broadcast commentator for big moments.",
    triggers: ["boundary", "six", "wicket", "milestone", "pressure_shift", "death_overs"],
    speak: true,
    priority: 100,
    createAgent: (model) =>
      new LlmAgent({
        name: "akash_commentary_agent",
        model,
        description: "Akash, the male high-energy cricket commentator for live moments.",
        instruction: `${contextInstruction}
You are Akash, the male lead cricket commentator.
Your style: energetic, emotional, stadium-first, IPL broadcast energy, but still natural.
Talk like a real person on live TV: short sentences, rhythm, pauses implied by punctuation.
React to the exact live event and score. Use batter, bowler, score, wickets, or over when available.
For sixes and boundaries, make the line feel explosive. For wickets and dots, make it feel tense.
In death overs, make the equation the emotional hook.
Do not overdo slogans. Do not scream every line. No fake stats. No emojis.
${commentaryLanguageGuide()}
English example style: "That has gone miles! RCB need 9 from 5, and suddenly the whole ground is shaking."
Hinglish example style: "Arre wah, ye ball seedha stands mein! RCB ko 9 from 5 chahiye, aur crowd pagal ho gaya hai."
${responseContract}`
      }),
    unavailable: "Akash is waiting for Gemini to return live commentary."
  },
  {
    id: "analyst_commentary",
    label: "Alia",
    description: "Female analyst commentator explaining why the moment matters.",
    triggers: ["boundary", "six", "wicket", "pressure_shift", "death_overs", "normal"],
    speak: true,
    priority: 90,
    createAgent: (model) =>
      new LlmAgent({
        name: "alia_commentary_agent",
        model,
        description: "Alia, the female tactical cricket analyst for live interpretation.",
        instruction: `${contextInstruction}
You are Alia, the female analyst commentator.
Your style: calm, smart, tactical, and conversational, like a broadcast partner responding to Akash.
Explain why the moment matters: field, length, batter intent, required rate, risk, or momentum.
Keep the energy alive, but give one sharp reason behind the moment.
Use only supplied match context. Avoid invented historical stats. No emojis.
${commentaryLanguageGuide()}
English example style: "That was about length. The bowler missed full, and the batter turned a pressure ball into release."
Hinglish example style: "Ye length ki mistake thi. Bowler full miss hua, aur batter ne pressure ball ko release bana diya."
${responseContract}`
      }),
    unavailable: "Alia is waiting for Gemini to return live analysis."
  },
  {
    id: "prediction",
    label: "Prediction Agent",
    description: "Projects score, win probability, and chase pressure.",
    triggers: ["boundary", "six", "wicket", "pressure_shift", "death_overs", "normal"],
    speak: false,
    priority: 70,
    createAgent: (model) =>
      new LlmAgent({
        name: "prediction_agent",
        model,
        description: "Cricket projection agent for win probability and score movement.",
        instruction: `${contextInstruction}
You are the projection agent. Mention projected score or win probability from the given context, then explain the pressure in one sentence.
Do not pretend to run a statistical model; phrase it as a live projection from current match context.
${commentaryLanguageGuide()}
${responseContract}`
      }),
    unavailable: "Prediction Agent is waiting for Gemini to return a projection."
  },
  {
    id: "strategy",
    label: "Strategy Agent",
    description: "Suggests tactical bowling, fielding, or batting moves.",
    triggers: ["wicket", "six", "boundary", "pressure_shift", "death_overs"],
    speak: false,
    priority: 60,
    createAgent: (model) =>
      new LlmAgent({
        name: "strategy_agent",
        model,
        description: "Tactical cricket strategy agent.",
        instruction: `${contextInstruction}
You are the strategy agent. Recommend one concrete tactical adjustment for the next ball.
Keep it actionable: length, field, batter intent, or bowling variation.
Avoid vague advice like "build pressure"; name the tactical lever.
${commentaryLanguageGuide()}
${responseContract}`
      }),
    unavailable: "Strategy Agent is waiting for Gemini to return a tactical recommendation."
  },
  {
    id: "sentiment",
    label: "Sentiment Agent",
    description: "Models crowd emotion and momentum.",
    triggers: ["boundary", "six", "wicket", "pressure_shift"],
    speak: false,
    priority: 50,
    createAgent: (model) =>
      new LlmAgent({
        name: "sentiment_agent",
        model,
        description: "Crowd and fan energy agent.",
        instruction: `${contextInstruction}
You are the sentiment agent. Describe the crowd energy and emotional momentum as a live broadcast insight.
No emojis. No memes. Make it vivid but professional.
Tie the emotion to the latest event and match state.
${commentaryLanguageGuide()}
${responseContract}`
      }),
    unavailable: "Sentiment Agent is waiting for Gemini to return live sentiment."
  }
];

export function getTriggeredAgents(momentType: MomentType) {
  return cricketAgents.filter((agent) => agent.triggers.includes(momentType));
}
