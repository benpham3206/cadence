export function generateLocalPortrait(profile, weakList) {
  if (!profile.sessions || profile.sessions.length === 0) {
    return "Complete a few sessions to generate your personal typist portrait.";
  }

  const recent = profile.sessions.slice(-10);
  const avgWpm = Math.round(recent.reduce((a, s) => a + s.wpm, 0) / recent.length);
  const readBuffer = (profile.chunkHorizon || 1.5).toFixed(1);

  if (!weakList || weakList.length === 0) {
    return `You average ${avgWpm} WPM with a ${readBuffer}-word read buffer. You currently have no identified friction points!`;
  }

  const weakNames = weakList.slice(0, 3).map(w => `'${w.digraph || w}'`).join(', ');
  return `You average ${avgWpm} WPM with a ${readBuffer}-word read buffer. Your top friction points dragging down your average are ${weakNames}.`;
}
