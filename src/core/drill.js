import { WORDS } from '../data/words.js';

export function generateDrillText(weakDigraphs, wordCount = 60) {
  if (!weakDigraphs || weakDigraphs.length === 0) return null;
  const targetSet = new Set(weakDigraphs.map(w => w.digraph || w));

  const scored = WORDS.map(word => {
    let score = 0;
    const lower = word.toLowerCase();
    for (const dg of targetSet) {
      if (lower.includes(dg)) score += 2;
    }
    return { word, score };
  }).filter(w => w.score > 0);

  if (scored.length === 0) return null;

  const result = [];
  let lastWord = '';
  for (let i = 0; i < wordCount; i++) {
    const pool = scored.filter(w => w.word !== lastWord);
    if (pool.length === 0) break;
    const totalScore = pool.reduce((a, w) => a + w.score, 0);
    let pick = Math.random() * totalScore;
    let chosen = pool[0];
    for (const w of pool) {
      pick -= w.score;
      if (pick <= 0) { chosen = w; break; }
    }
    result.push(chosen.word);
    lastWord = chosen.word;
  }
  return result.join(' ');
}
