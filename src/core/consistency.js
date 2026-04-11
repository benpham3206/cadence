export function computeConsistency(dwells) {
  if (dwells.length < 2) return 0;
  const mean = dwells.reduce((a, b) => a + b, 0) / dwells.length;
  if (mean === 0) return 0;
  const variance = dwells.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dwells.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
}
