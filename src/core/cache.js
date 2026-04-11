export function computeWeakHash(weakList) {
  return weakList.map(w => w.digraph || w).sort().join(',');
}
