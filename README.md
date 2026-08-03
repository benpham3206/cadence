# Cadence

A typing trainer for people who are already fast.

Most typing sites measure how quickly you finished. Cadence measures **which specific key transitions cost you time**, then finds real quotes that are unusually dense in exactly those transitions and puts them in front of you. Read, diagnose, repair, back to reading.

```
quote → quote → quote → quote → targeted → targeted → quote → …
```

Built for typists working past 130 WPM, where the remaining gains are hiding in a few dozen awkward two-character transitions rather than in general practice.

---

## Why transitions

At 60 WPM your ceiling is recognition: you are still finding keys. At 130+ the keys are automatic and the ceiling moves to the *joins* between them. Some pairs are simply expensive:

- **Same-finger bigrams** — `ed`, `ws`, `ny`, `lo`. One finger has to lift, travel, and land before the next keystroke can start. There is no overlap to hide the cost in.
- **Pinky stretches** — `lp`, `p;`, `qa`. The weakest finger covering the most distance.
- **Awkward hand-internal rolls** — sequences that fight the natural inward roll of the hand.

A session-average WPM cannot see any of this. It reports one number for thousands of keystrokes with wildly different costs. Cadence times every transition separately and shows you the distribution.

## How it works

**Measurement.** Every keystroke records dwell (how long the key was held) and flight (keydown to keydown from the previous key), via `performance.now()`. Per-transition statistics accumulate using [Welford's algorithm](https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm) — numerically stable, constant time per update, and small enough to serialise into `localStorage`.

Only correct keystrokes contribute timings. The pause after a mistake is recovery time, not travel time, and folding it in makes every transition look slow.

**Diagnosis.** Two signals combine:

- The *persistent profile* ranks transitions by mean flight time across your whole history.
- *Slow-section detection* scans the passage you just typed with a rolling window and finds the stretches where your rhythm actually broke down.

Recency is weighted up, because motor learning responds to addressing a stumble now rather than a statistical tendency from last week — but the long-run profile still anchors the list, so drills do not chase noise.

**Repair.** Each of the 6,486 quotes is scored for how densely it contains your weakest transitions, weighted by how far above your own baseline each one sits. The winner is real prose, not generated filler:

> *Fear is a strange soil. Mainly it grows obedience like corn, which grows in ro**ws** and makes weeding easy. But sometimes it gro**ws** the potatoes of defiance, which flourish underground.*

Four reps of `ws` in 181 characters of actual writing. When no quote is dense enough for a rare transition, a synthetic word drill is generated as a fallback.

**Form.** A keyboard and hand diagram shows the correct finger for the next character, including which pinky should be holding shift. Reaching 130 WPM with improvised fingering builds a ceiling that practice alone will not move.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 107 tests, no browser required
npm run build    # static output in dist/
```

Regenerate the quote corpus from upstream:

```bash
npm run build:quotes
```

The generated corpus is committed on purpose, so a production build never depends on a network fetch.

## Deploying

The output is a static site with no server component, no API keys and no backend. On Vercel, import the repository and accept the detected settings — `vercel.json` pins the framework, build command and cache headers.

## Architecture

Vanilla JavaScript and Vite. No framework, no runtime dependencies. For an app whose entire job is responding to keystrokes without perceptible latency, a render layer between the keydown handler and the DOM is a cost with no matching benefit. The bundle is about 19 KB gzipped.

```
src/
  core/            no DOM, fully unit tested
    digraph.js       Welford statistics per transition
    run.js           one passage attempt: scoring, timing, accuracy
    corpus.js        quote library loading and validation
    selector.js      density scoring and targeted selection
    slow-sections.js rolling-window stumble detection
    session-flow.js  the quote → targeted → quote cycle
    keyboard-layout.js  QWERTY layout and finger assignments
    coach.js         post-run diagnostic tips
    profile.js       localStorage persistence and migration
    result.js        structured success/failure contract
  ui/              DOM rendering only
  app/App.js       wiring between the two
```

`core/` never imports from `ui/`. Everything in it runs under `node --test` with no browser or DOM shim.

### Errors

Fallible operations return a result rather than throwing or returning `null`:

```js
{ ok: false, error: { component: 'selector.targeted',
                      failureType: 'not-found',
                      rootCause: 'no quote within the length limit contains any of these transitions',
                      context: { targets: ['zq'], maxLength: 300 } } }
```

A failure names what broke and why, so a console line is enough to act on.

### Data

Everything lives in `localStorage` under `cadence_profile_v3`. No accounts, no telemetry, nothing leaves the browser. Profiles export and import as JSON, and older profile versions migrate forward — the digraph statistics are the part that takes real hours to accumulate, so migration never discards them.

## Keyboard

| Key | Action |
| --- | --- |
| `esc` | Zen mode — hides everything but the passage |
| `ctrl` + `enter` | Skip to the next passage |
| any key | Dismiss the result card early |

## Credits and licence

The 6,486-quote English library comes from [monkeytype](https://github.com/monkeytypegame/monkeytype), whose visual language also shaped this interface. The adaptive-practice idea is [keybr](https://www.keybr.com)'s, applied to transitions rather than letters. The hand-position guidance follows the convention used by [typing.com](https://www.typing.com) and other touch-typing curricula.

Licensed under [GPL-3.0](LICENSE), matching monkeytype, whose quote data this project includes.
