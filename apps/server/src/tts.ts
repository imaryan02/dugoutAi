import type { AgentOutput, VoiceAudio } from "@agent11/shared";

interface GoogleTtsResponse {
  audioContent?: string;
}

const voiceByAgent: Partial<Record<AgentOutput["agentId"], { name: string; pitch: number; speakingRate: number }>> = {
  hype_commentary: {
    name: process.env.TTS_AKASH_VOICE || "hi-IN-Wavenet-B",
    pitch: -0.5,
    speakingRate: 1.04
  },
  analyst_commentary: {
    name: process.env.TTS_ALIA_VOICE || "hi-IN-Wavenet-A",
    pitch: 0.5,
    speakingRate: 0.98
  }
};

function ttsApiKey() {
  return process.env.GOOGLE_TTS_API_KEY || process.env.TTS_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function languageCodeFromVoice(voiceName: string) {
  return process.env.TTS_LANGUAGE_CODE || voiceName.split("-").slice(0, 2).join("-") || "hi-IN";
}

export function isTtsEnabled() {
  return process.env.ENABLE_TTS === "true" && Boolean(ttsApiKey());
}

export async function synthesizeCommentary(output: AgentOutput): Promise<VoiceAudio | null> {
  if (!output.speak || !isTtsEnabled()) {
    return null;
  }

  const voice = voiceByAgent[output.agentId];
  if (!voice) {
    return null;
  }

  const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsApiKey()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: {
        text: output.text
      },
      voice: {
        languageCode: languageCodeFromVoice(voice.name),
        name: voice.name
      },
      audioConfig: {
        audioEncoding: "MP3",
        pitch: voice.pitch,
        speakingRate: voice.speakingRate
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Google TTS HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GoogleTtsResponse;
  if (!payload.audioContent) {
    return null;
  }

  return {
    mimeType: "audio/mpeg",
    data: payload.audioContent,
    voiceName: voice.name
  };
}
