export class Ghost {
  encode(text, events, wpm, errors) {
    const typing = events.filter(e => e.key.length === 1);
    const deltas = [];
    let base = typing[0]?.timestamp ?? 0;
    typing.forEach((e, i) => {
      deltas.push({
        charIndex: i,
        deltaMs: i === 0 ? 0 : Math.round(e.timestamp - base),
      });
    });
    return {
      textHash: this.hash(text),
      timestamp: Date.now(),
      events: deltas,
      wpm,
      accuracy: text.length > 0 ? Math.round(((text.length - errors) / text.length) * 100) : 0,
    };
  }

  hash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h) + text.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  isBetterThan(a, b) {
    if (a.wpm !== b.wpm) return a.wpm > b.wpm;
    return a.accuracy > b.accuracy;
  }

  overlayPositionAt(recording, elapsedMs) {
    const evts = recording.events;
    if (!evts.length) return 0;
    let idx = 0;
    for (let i = 0; i < evts.length; i++) {
      if (evts[i].deltaMs <= elapsedMs) idx = evts[i].charIndex;
      else break;
    }
    return idx;
  }
}
