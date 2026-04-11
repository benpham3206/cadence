const FINGER_MAP = {
  'left-pinky': new Set('`~1!2@qazQAZ'),
  'left-ring': new Set('3#wsxWSX'),
  'left-middle': new Set('4$5%edcEDC'),
  'left-index': new Set('6^7&8*rfbRFTGvBtfgbTFGVCB'),
  'right-index': new Set('9(0)yhnYHNUJMjmujn'),
  'right-middle': new Set('-=ik,IK<'),
  'right-ring': new Set('[{ol.OL>'),
  'right-pinky': new Set(']}\\|;\'":/pP?'),
  'thumb': new Set(' '),
};

export class Coach {
  fingerForKey(key) {
    if (!key || key.length !== 1) return null;
    for (const [finger, chars] of Object.entries(FINGER_MAP)) {
      if (chars.has(key)) return finger;
    }
    return null;
  }

  fingerForDigraph(prev, cur) {
    return { from: this.fingerForKey(prev), to: this.fingerForKey(cur) };
  }

  analyze(events, digraphMap, sessions) {
    const tips = [];
    const typing = events.filter(e => e.key.length === 1);
    if (typing.length < 10) return tips;

    // Fatigue detection: dwells increasing over session halves
    const dwells = typing.map(e => e.dwell);
    const mid = Math.floor(dwells.length / 2);
    const firstHalf = dwells.slice(0, mid);
    const secondHalf = dwells.slice(mid);
    if (firstHalf.length && secondHalf.length) {
      const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (avg2 > avg1 * 1.25) {
        tips.push('Your dwell times are climbing — take a breath and reset your hands.');
      }
    }

    // Weak digraph finger-specific tips
    const weakList = digraphMap.getWeakList(3);
    for (const w of weakList) {
      const dg = w.digraph;
      if (dg.length !== 2) continue;
      const fingers = this.fingerForDigraph(dg[0], dg[1]);
      if (fingers.from && fingers.to && fingers.from === fingers.to) {
        tips.push(`Same-finger transition <strong>${dg}</strong> is slowing you down — try rolling the motion rather than lifting.`);
      } else if (dg.includes('q') || dg.includes('z') || dg.includes('p')) {
        tips.push(`Outer-key digraph <strong>${dg}</strong> is a friction point — extra practice will help.`);
      }
    }

    // Consistency celebration
    const consistency = (() => {
      const mean = dwells.reduce((a, b) => a + b, 0) / dwells.length;
      if (mean === 0) return 0;
      const variance = dwells.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dwells.length;
      const cv = Math.sqrt(variance) / mean;
      return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
    })();
    if (consistency > 90) {
      tips.push('Outstanding consistency — your motor patterns are highly automatized.');
    }

    // Track suggestion based on recent history
    const recentTracks = sessions.slice(-5).map(s => s.track);
    const onlyQuotes = recentTracks.every(t => t === 'C' || t === 'quote');
    if (onlyQuotes && recentTracks.length >= 5 && weakList.length > 0) {
      tips.push('You have identified weak digraphs — try a <strong>Practice</strong> session to drill them.');
    }

    return tips.slice(0, 3);
  }
}
