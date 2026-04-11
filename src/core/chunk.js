export function estimateChunkHorizon(events) {
  const interWord = [];
  const intraWord = [];

  for (let i = 1; i < events.length; i++) {
    const flight = events[i].flight;
    if (flight == null || flight < 0 || flight > 2000) continue;
    if (events[i - 1].key === ' ') {
      interWord.push(flight);
    } else if (events[i].key !== ' ') {
      intraWord.push(flight);
    }
  }

  if (intraWord.length < 5 || interWord.length < 3) return 1.5;

  const avgInter = interWord.reduce((a, b) => a + b, 0) / interWord.length;
  const avgIntra = intraWord.reduce((a, b) => a + b, 0) / intraWord.length;

  if (avgIntra === 0) return 1.0;
  const ratio = avgIntra / avgInter;
  const horizon = 1.0 + ratio * 3.0;
  return Math.max(1.0, Math.min(4.0, Math.round(horizon * 10) / 10));
}

export function countWordsBetween(text, posA, posB) {
  if (posA >= posB) return 0;
  const slice = text.slice(posA, posB);
  return slice.split(/\s+/).filter(Boolean).length;
}
