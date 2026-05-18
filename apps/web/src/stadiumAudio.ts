export const stadiumAudio = {
  crowdBed: "/audio/stadium/crowd.mp3",
  leagueTune: "/audio/stadium/ipltune.mp3",
  boundarySting: "/audio/stadium/boundary.mp3",
  noBallSting: "/audio/stadium/noball.mp3",
  wicketSting: "/audio/stadium/wicket.mp3",
  dhoniFinish: "/audio/stadium/dhoni.mp3",
  fanMeterCall: "/audio/stadium/fanmeter.mp3",
  teamCheer: "/audio/stadium/rcbcheer.mp3",
  opponentCheer: "/audio/stadium/cskcheer.mp3"
} as const;

export type StadiumAudioKey = keyof typeof stadiumAudio;
