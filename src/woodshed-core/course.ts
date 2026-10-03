// The course: every drill, phrase and part, in the order they come up.
//
// It is built backwards from three tabs (Bone Bottom and Bilewater by RYS,
// Theme of Laura) rather than from a general beginner syllabus: every drill is
// here because some bar of those songs needs it, and `why` says which.
//
// Tempos are the metronome click (a quarter note). Tab notation is described
// in tools/gp2json.py; strings count from 0 = lowest.
import type { Item } from './model.ts'

const rep = (tok: string, n: number) => Array(n).fill(tok).join(' ')
/** one beat: the same duration and mark on several notes at once */
const chord = (dur: string, notes: string[], mark = '') => `${dur}(${notes.map((n) => n + mark).join(' ')})`

export const E_STANDARD = [40, 45, 50, 55, 59, 64]
export const D_STANDARD = [38, 43, 48, 53, 57, 62]

// ── technique ───────────────────────────────────────────────────────────────
const P5 = ['1:5', '2:7', '3:7'] // root, fifth, octave
const EM = ['0:0', '1:2', '2:2', '3:0', '4:0', '5:0']

const DRILLS: Item[] = [
  {
    id: 't-click', name: 'Lock to the click', lane: 'time', fret: 1, kind: 'drill', req: [], mins: 3, start: 60, target: 90,
    why: 'Every bar of all three songs sits on a steady pulse. This is the habit the rest is built on.',
    how: [
      'Rest the side of your picking hand on the low string so it thuds instead of ringing.',
      'Bar one: a downstroke on each click. Bar two: down-up, two notes per click. Count "1 and 2 and" out loud.',
      'Tap your foot with the click. If the click seems to vanish, you are exactly on it.',
    ],
    tab: [rep('4(0:0pm)', 4), rep('8(0:0pm)', 8)],
  },
  {
    id: 'f-1234', name: 'One finger per fret', lane: 'fret', fret: 1, kind: 'drill', req: [], mins: 4, start: 50, target: 90,
    why: 'Four fingers covering four frets is the hand shape behind every lead line in Bone Bottom and Bilewater.',
    how: [
      'Index on 5, middle on 6, ring on 7, pinky on 8. Keep each finger down until you leave the string.',
      'Fingertips just behind the fret wire, thumb behind the neck roughly under your middle finger.',
      'Fingers that are not playing hover close to the strings. Small movements are what become speed later.',
    ],
    tab: [0, 2, 4].map((s) => [5, 6, 7, 8].map((f) => `8(${s}:${f})`).join(' ') + ' ' + [5, 6, 7, 8].map((f) => `8(${s + 1}:${f})`).join(' '))
      .concat([4, 2, 0].map((s) => [8, 7, 6, 5].map((f) => `8(${s + 1}:${f})`).join(' ') + ' ' + [8, 7, 6, 5].map((f) => `8(${s}:${f})`).join(' '))),
  },
  {
    id: 'p-alt', name: 'Alternate picking on one string', lane: 'pick', fret: 1, kind: 'drill', req: [], mins: 3, start: 60, target: 110,
    why: 'Bone Bottom runs in unbroken eighth notes for sixteen bars. Strict down-up picking is what makes that effortless.',
    how: [
      'Down on the click, up between clicks, with no exceptions, even when it feels easier to cheat.',
      'Move from the wrist. Let only the tip of the pick pass through the string.',
      'Keep downstrokes and upstrokes the same volume.',
    ],
    tab: [rep('8(3:7)', 8), rep('8(3:7) 8(3:9)', 4), rep('8(3:7) 8(3:9) 8(3:10) 8(3:9)', 2)],
  },
  {
    id: 'p-cross', name: 'String crossing', lane: 'pick', fret: 2, kind: 'drill', req: ['p-alt'], mins: 4, start: 50, target: 90,
    why: 'The Bone Bottom lead hops between the G, B and D strings on almost every note (bars 25-40).',
    how: [
      'Keep the picking strictly down-up even when the string changes. Do not restart on a downstroke.',
      'Bar two is the actual Bone Bottom cell. Bar three skips a string.',
      'Mute the string you just left with the underside of your fretting finger so notes do not smear.',
    ],
    tab: ['8(3:7) 8(4:8) 8(3:7) 8(4:8) 8(3:9) 8(4:10) 8(3:9) 8(4:10)', '8(4:10) 8(3:7) 8(3:9) 8(3:7) 8(3:9) 8(3:7) 8(3:9) 8(3:7)', '8(2:9) 8(4:8) 8(2:9) 8(4:8) 8(2:7) 8(4:10) 8(2:7) 8(4:10)'],
  },
  {
    id: 'f-stretch', name: 'Stretch shapes', lane: 'fret', fret: 2, kind: 'drill', req: ['f-1234'], mins: 4, start: 40, target: 57,
    why: 'The Bone Bottom clean intro is three wide four-string shapes spanning five frets.',
    how: [
      'Bar one: index on the G string 3rd fret, middle on A 5, ring on B 6, pinky on D 7. Place all four, then pick.',
      'Drop your thumb lower behind the neck and bring your elbow in. The reach comes from the hand opening, not from pressing harder.',
      'If it hurts, learn the same shapes five frets higher where the frets are closer, then walk them down a fret a week.',
    ],
    tab: ['8(1:5) 8(2:7) 8(3:3) 8(4:6) 2(4:6~)', '8(0:5) 8(1:7) 8(2:3) 8(3:5) 2(3:5~)', '8(0:6) 8(1:8) 8(2:5) 8(3:7) 2(3:7~)'],
  },
  {
    id: 'p-ring', name: 'Let-ring arpeggios', lane: 'pick', fret: 3, kind: 'drill', req: ['p-alt'], mins: 4, start: 50, target: 80,
    why: 'Both clean guitar parts are arpeggios that ring into each other. Bilewater keeps one going for 72 bars.',
    how: [
      'Hold the whole shape down before you pick anything, and keep it down. Every note keeps ringing.',
      'Arch your fingers so no fingertip touches the string next to it. A dead note means a finger is leaning.',
      'Pick down while climbing toward the thin strings and up while coming back.',
    ],
    tab: ['8(1:2) 8(2:2) 8(3:0) 8(4:0) 2(4:0~)', '8(1:3) 8(2:5) 8(3:2) 8(5:0) 2(5:0~)', '8(2:2) 8(3:0) 8(4:0) 8(5:0) 8(4:0) 8(3:0) 8(2:2) 8(3:0)'],
  },
  {
    id: 'v-slide', name: 'Slides that land', lane: 'voice', fret: 3, kind: 'drill', req: ['f-1234'], mins: 3, start: 50, target: 80,
    why: 'Theme of Laura is full of 7-to-9 slides, and Bilewater slides into most of its long notes.',
    how: [
      'Pick the first note only. Keep the pressure on and glide; the second note is not picked.',
      'Look at the fret you are going to, not the one you are leaving.',
      'Bar three is the grace slide: start a fret or two below and arrive exactly on the click.',
    ],
    tab: ['4(3:7/) 4(3:9) 4(3:9/) 4(3:7)', '4(4:8/) 4(4:10) 4(4:10/) 4(4:12)', 'g(3:7/) 2(3:9) g(4:10/) 2(4:11)'],
  },
  {
    id: 'f-high', name: 'Above the 12th fret', lane: 'fret', fret: 4, kind: 'drill', req: ['f-1234'], mins: 4, start: 50, target: 80,
    why: 'Bone Bottom lives at frets 17-19 for its whole second half, and the Bilewater clean melody goes up to 23.',
    how: [
      'The frets are much narrower up here. Play on your fingertips and aim small.',
      'Bring your thumb round toward the heel of the neck and let your wrist drop so the fingers stay curved.',
      'Bar three is the Bone Bottom clean pattern: hold e-17 and B-17 with one finger and reach G-19 with the ring finger.',
    ],
    tab: ['8(3:14) 8(3:15) 8(3:16) 8(3:17) 8(4:14) 8(4:15) 8(4:16) 8(4:17)', '8(5:14) 8(5:15) 8(5:16) 8(5:17) 8(5:17) 8(5:16) 8(5:15) 8(5:14)', '8(5:17) 8(3:19) 8(4:17) 8(3:19) 8(4:17) 8(3:19) 8(4:17) 8(5:18)'],
  },
  {
    id: 'v-hammer', name: 'Hammer-ons and pull-offs', lane: 'voice', fret: 4, kind: 'drill', req: ['f-1234'], mins: 3, start: 50, target: 90,
    why: 'Bone Bottom, Bilewater and Theme of Laura all use them to join two notes without picking the second.',
    how: [
      'Hammer-on: pick the lower note, then bring the next finger down hard and fast right behind the fret.',
      'Pull-off: flick the finger slightly downward as it leaves, as if plucking the string with it.',
      'The second note should be as loud as the picked one. If it is quiet, hammer faster, not harder.',
    ],
    tab: ['8(3:7h) 8(3:9) 8(3:7h) 8(3:9) 8(3:9h) 8(3:7) 8(3:9h) 8(3:7)', '8(4:8h) 8(4:10) 8(4:8h) 8(4:10) 8(4:10h) 8(4:8) 8(4:10h) 8(4:8)'],
  },
  {
    id: 't-dotted', name: 'Dotted quarter, then eighth', lane: 'time', fret: 4, kind: 'drill', req: ['t-click'], mins: 3, start: 60, target: 93,
    why: 'This long-short rhythm is the heartbeat of Bilewater: the lead, the second clean guitar and the rhythm guitar all play it.',
    how: [
      'Count "1 and 2 AND 3 and 4 AND". The long note lasts three counts, the short one lands on the capital AND.',
      'Keep your picking hand swinging down-up on every count, even the ones you do not play.',
      'Bar two starts on a rest: feel beat 1 and 2 go by before the first note.',
    ],
    tab: ['4.(4:11) 8(4:11) 4.(4:11) 8(4:11)', 'r4. 8(4:11) 4.(4:9) 8(4:11)', '4.(4:9) 8(4:11) 4.(3:11) 8(4:11)'],
  },
  {
    id: 'v-bend-half', name: 'Half-step bend, in tune', lane: 'voice', fret: 5, kind: 'drill', req: ['f-1234'], mins: 4,
    why: 'The first phrase of both lead parts is a note bent up a half step and let back down.',
    how: [
      'Play the 11th fret first and remember that pitch. Then bend the 10th fret up until it sounds exactly the same.',
      'Bend with your ring finger and put the middle and index fingers behind it on the same string. Three fingers push.',
      'Turn your wrist like turning a door handle rather than pushing with the fingertips.',
      'Bar two: pick, bend up, let it back down without re-picking. The release has to stay in tune too.',
    ],
    tab: ['2(4:11) 2(4:10b50)', '4(4:10) 4(4:10~b50) 2(4:10~b0)'],
  },
  {
    id: 'r-strum', name: 'Down-up strumming engine', lane: 'rhythm', fret: 5, kind: 'drill', req: ['t-click'], mins: 3, start: 60, target: 100,
    why: 'Theme of Laura ends its sections on open E minor chords. One chord, no changes: this is about the strumming arm.',
    how: [
      'Hold E minor: middle finger A string 2nd fret, ring finger D string 2nd fret, everything else open.',
      'Your arm swings down-up in constant eighth notes like a pendulum and never stops.',
      'The pattern is down, down-up, (miss), up, down-up. On the miss the arm still swings but stays clear of the strings.',
    ],
    tab: [`${chord('4', EM)} ${chord('8', EM)} ${chord('8', EM)} ${chord('8', EM, '~')} ${chord('8', EM)} ${chord('8', EM)} ${chord('8', EM)}`],
  },
  {
    id: 'v-grace', name: 'Grace-note slide-ins', lane: 'voice', fret: 6, kind: 'drill', req: ['v-slide', 'p-cross'], mins: 3, start: 50, target: 93,
    why: 'Bone Bottom hands each four-bar loop to the next with a quick slide from 10 to 11 (bars 24, 32, 40). Bilewater slides into phrases the same way.',
    how: [
      'The small note takes no time of its own. Pick it and be on the main note by the click.',
      'Bar two is Bone Bottom bar 32 as written. The slide comes right after an upstroke, so prepare the finger early.',
    ],
    tab: ['r2 r4 r8 g(4:10/) 8(4:11)', '8(4:10) 8(3:7) 8(3:9) 8(3:7) 8(3:9) 8(3:7) 8(3:9) g(4:10/) 8(4:11)', 'g(4:7/) 4.(4:9) 8(4:11) 4.(4:12) 8(4:11)'],
  },
  {
    id: 'p-palm', name: 'Palm muting', lane: 'pick', fret: 6, kind: 'drill', req: ['p-alt'], mins: 3, start: 60, target: 100,
    why: 'The rhythm guitars chug with it, and the fast Bilewater lead runs are palm-muted to keep them tight.',
    how: [
      'Rest the fleshy edge of your picking hand on the strings right where they leave the bridge.',
      'Too far forward and the note dies; too far back and it rings. Find the spot that gives a tight thump with a clear pitch.',
      'Bar three accents the first of every four by lifting the palm for just that note.',
    ],
    tab: [`${rep('8(0:0pm)', 4)} ${rep('8(0:0)', 4)}`, rep('8(1:5pm)', 8), rep('8(0:0) 8(0:0pm) 8(0:0pm) 8(0:0pm)', 2)],
  },
  {
    id: 'r-power', name: 'Power chords and octaves', lane: 'rhythm', fret: 6, kind: 'drill', req: ['p-alt'], mins: 4, start: 50, target: 93,
    why: 'These two shapes are the entire rhythm guitar part of both songs.',
    how: [
      'Power chord: index on the root, ring finger two frets up on the next string, pinky under it. Play only those three strings.',
      'Octave: index on the root, ring or pinky two strings over and two frets up. The index leans back to mute the string in between.',
      'Move the hand as one locked shape. Relax the pressure during the shift but keep the fingers touching the strings.',
    ],
    tab: [`${chord('2', P5)} ${chord('2', ['1:4', '2:6', '3:6'])}`, chord('1', ['1:2', '2:4', '3:4']), '2(1:5 3:7) 2(1:4 3:6)', '1(1:2 3:4)'],
  },
  {
    id: 'v-bend-full', name: 'Whole-step bend, in tune', lane: 'voice', fret: 7, kind: 'drill', req: ['v-bend-half'], mins: 4,
    why: 'Bilewater bends a full tone in bars 51-52, 56 and 64, and both songs end on one.',
    how: [
      'Reference first: the pitch you want is two frets higher. Play the 11th fret, then bend the 9th up to match it.',
      'It takes about twice the push of a half-step bend. Keep the supporting fingers behind the bending finger.',
      'Most beginners stop short and land flat. Check against the reference note every few tries.',
    ],
    tab: ['2(4:11) 2(4:9b100)', '4(4:9b100) 4(4:9~b0) 2(4:7)'],
  },
  {
    id: 'r-chug', name: 'Chug and release', lane: 'rhythm', fret: 7, kind: 'drill', req: ['r-power', 'p-palm', 't-dotted'], mins: 4, start: 56, target: 93,
    why: 'The Bilewater rhythm guitar from bar 43 to 60: a ringing chord for three counts, then one muted stab.',
    how: [
      'Let the long chord ring with the palm off, then drop the palm for the short one.',
      'It is the dotted-quarter rhythm from the Time string, now with a whole chord.',
      'Bars two and three move the shape. Shift during the muted stab, not after it.',
    ],
    tab: [
      rep(`${chord('4.', ['1:2', '2:4', '3:4'])} ${chord('8', ['1:2', '2:4', '3:4'], 'pm')}`, 2),
      `${chord('4.', ['1:2', '2:4', '3:4'])} ${chord('8', ['1:2', '2:4', '3:4'], 'pm')} ${chord('4.', ['1:4', '2:6', '3:6'])} ${chord('8', ['1:4', '2:6', '3:6'], 'pm')}`,
      rep(`${chord('4.', P5)} ${chord('8', P5, 'pm')}`, 2),
    ],
  },
  {
    id: 't-sixteenth', name: 'Sixteenth notes', lane: 'time', fret: 7, kind: 'drill', req: ['t-click', 'p-alt'], mins: 3, start: 40, target: 66,
    why: 'The Bone Bottom rhythm guitar drops pairs of sixteenths into its eighth notes (bars 33-37).',
    how: [
      'Four even notes per click. Count "1 e and a".',
      'Bar two mixes an eighth with two sixteenths. Keep the hand moving in sixteenths the whole time and just skip a stroke.',
    ],
    tab: [rep('16(3:7)', 16), rep('8(3:7) 16(3:7) 16(3:7)', 4)],
  },
  {
    id: 'v-vibrato', name: 'Vibrato on a held note', lane: 'voice', fret: 8, kind: 'drill', req: ['v-bend-half'], mins: 3,
    why: 'Both leads are mostly long notes. Vibrato is what stops a whole-note from sounding like a beginner holding a fret.',
    how: [
      'It is a row of tiny bends: push the string a little sharp and let it come back to pitch, evenly.',
      'Same wrist-turn as bending. Start slow and wide. An even pulse matters more than speed.',
      'Let the note ring plain for a moment before the vibrato starts.',
    ],
    tab: ['1(3:8)', '1(4:11)', '1(5:14)'],
  },
  {
    id: 'f-shift', name: 'Position shifts', lane: 'fret', fret: 8, kind: 'drill', req: ['v-slide', 'f-high'], mins: 3, start: 56, target: 93,
    why: 'Bilewater jumps four frets up the B string by sliding (bars 14-15) and ends by sliding from 12 to 16.',
    how: [
      'The slide is the shift: the finger that slides takes the whole hand with it.',
      'Thumb and fingers move together. If the thumb stays behind you will land flat.',
      'Look at the target fret before you leave.',
    ],
    tab: ['4.(4:9) 8(4:11/) 4.(4:15) 8(4:11/)', '1(4:16)', '2(5:12/) 2(5:16)'],
  },
  {
    id: 'r-gallop', name: 'Gallop', lane: 'rhythm', fret: 8, kind: 'drill', req: ['r-power', 'p-palm', 't-sixteenth'], mins: 4, start: 40, target: 57,
    why: 'Bone Bottom rhythm guitar, bars 33-37: a ringing chord, two muted sixteenths, and on.',
    how: [
      'The full chord rings; the two quick notes are palm-muted on the lower two strings only.',
      'Pick down for the chord, then down-up for the pair.',
      'The tied chord in the middle of the bar is held, not hit again.',
    ],
    tab: [`${chord('8', P5)} 16(1:5pm 2:7pm) 16(1:5pm 2:7pm) ${chord('8', P5)} ${chord('8', P5)} ${chord('8', P5, '~')} ${chord('8', P5)} ${chord('8', P5)} 16(1:5pm 2:7pm) 16(1:5pm 2:7pm)`],
  },
  {
    id: 'f-box', name: 'Three notes per string', lane: 'fret', fret: 9, kind: 'drill', req: ['f-1234', 'p-cross'], mins: 4, start: 50, target: 93,
    why: 'The big Bilewater run in bar 62 climbs exactly this scale shape. Learn the map before adding the speed.',
    how: [
      'Index, middle or ring, pinky on each string. Say the fret numbers until the shape is memorised.',
      'Strict alternate picking. With three notes on a string the pick direction flips on every new string; let it.',
      'Up in bar one, over the top in bar two, back down in bar three.',
    ],
    tab: ['8(2:9) 8(2:11) 8(3:8) 8(3:10) 8(3:11) 8(4:9) 8(4:11) 8(4:12)', '8(5:9) 8(5:11) 8(5:13) 8(5:14) 8(5:13) 8(5:11) 8(5:9) 8(4:12)', '8(4:11) 8(4:9) 8(3:11) 8(3:10) 8(3:8) 8(2:11) 8(2:9) 8(2:11)'],
  },
  {
    id: 't-triplet', name: 'Triplets', lane: 'time', fret: 9, kind: 'drill', req: ['t-click', 'p-alt'], mins: 3, start: 50, target: 93,
    why: 'The fast Bilewater licks are six notes to a beat. Three to a beat comes first.',
    how: [
      'Three even notes per click. Say "tri-po-let" or "1 and a".',
      'With alternate picking the click falls on a downstroke, then an upstroke, then a downstroke. That is correct.',
    ],
    tab: [rep('8t(3:7)', 12), rep('8t(3:7) 8t(3:9) 8t(3:10)', 4)],
  },
  {
    id: 'v-bend-vib', name: 'Bend, hold, vibrato', lane: 'voice', fret: 10, kind: 'drill', req: ['v-bend-full', 'v-vibrato'], mins: 4, own: 4,
    why: 'Bilewater bars 20-22 hold a bent note for six beats, and the song ends on a bend that just hangs there.',
    how: [
      'Bend to pitch and stop there. Hold it dead steady for two counts before anything else.',
      'Then add vibrato by letting the string down a hair and pushing back to pitch, never above it.',
      'Holding a bend takes forearm strength. Tired means stop; it builds over weeks.',
    ],
    tab: ['1(4:11b50)', '2(4:11~) 2(4:11~b0)', '4(5:16b100) 2.(5:16~)'],
  },
  {
    id: 'p-sext', name: 'Sextuplet bursts', lane: 'pick', fret: 10, kind: 'drill', req: ['t-triplet', 'p-palm', 'f-box'], mins: 5, start: 46, target: 93, own: 4,
    why: 'Bilewater bars 41, 47, 55-56 and 62: six notes per beat at 93 bpm. This is the hardest thing in either song, and the last to arrive.',
    how: [
      'Six notes, land on a long one, rest. Speed comes from short bursts, not from long runs played tense.',
      'Keep the pick motion tiny and the hand loose. If your forearm tightens you are over your tempo: come down.',
      'Bar two is one burst across three strings from the real run.',
      'Expect this one to stay in rotation for months. That is normal.',
    ],
    tab: [`${rep('16t(4:9)', 6)} 4(4:9) ${rep('16t(4:9)', 6)} 4(4:9)`, '16t(3:8pm) 16t(3:10pm) 16t(3:11pm) 16t(4:9pm) 16t(4:11pm) 16t(4:12pm) 4(5:9) r2'],
  },
  {
    id: 'v-pinch', name: 'Pinch harmonics', lane: 'voice', fret: 11, kind: 'drill', req: ['v-bend-half', 'p-palm'], mins: 4, own: 4,
    why: 'Bilewater bar 41 opens the solo with a bent note that squeals. That squeal is a pinch harmonic.',
    how: [
      'Choke up on the pick until almost none shows. As you pick, let the side of your thumb brush the string right after the pick does.',
      'Where you pick along the string changes which harmonic sounds. Hunt around above the pickups.',
      'Needs gain: use the bridge pickup with distortion. On a clean tone it barely speaks.',
    ],
    tab: ['2(3:7H) 2(3:9H)', '1(4:11H)'],
  },
]

// ── songs ───────────────────────────────────────────────────────────────────
const BB = 'bone-bottom'
const BW = 'bilewater'
const LV = 'theme-of-laura-v2'
const MK = 'mantis-lords'
const LOW_GEAR =
  'Written for a guitar tuned far below a normal six-string. In D standard, drop your low string one more step to C and play the same frets: the shapes and the picking are identical, it just sounds higher than the record.'

interface Part { id: string; name: string; fret: number; song?: string; track?: number; bars?: [number, number]; why: string; gear?: string; start?: number; target?: number; extraReq?: string[]; how?: string[] }
type Ph = [id: string, name: string, from: number, to: number, req: string[], how: string[], extra?: Partial<Item>]

/** A guitar part = its phrases in order, then the part played whole. */
function part(p: Part, phrases: Ph[]): Item[] {
  const out: Item[] = phrases.map(([id, name, from, to, req, how, extra]) => ({
    id, name, lane: 'songs', fret: p.fret, kind: 'phrase', req, mins: 5, start: p.start, target: p.target,
    why: `${p.name}, ${from === to ? `bar ${from}` : `bars ${from}-${to}`}.`,
    how, src: { song: p.song as string, track: p.track as number, from, to }, part: p.id, gear: p.gear, ...extra,
  }))
  out.push({
    id: p.id, name: p.name, lane: 'songs', fret: p.fret, kind: 'song', req: [...phrases.map((x) => x[0]), ...(p.extraReq ?? [])], mins: 8,
    start: p.start, target: p.target, why: p.why, gear: p.gear,
    how: p.how ?? [
      'Play the part from its first bar to its last without stopping, with the recording or the metronome.',
      'A mistake is not a reason to stop: keep your place and come back in. That is the skill being trained here.',
      'Log it clean only when the whole pass was clean.',
    ],
    src: p.bars ? { song: p.song as string, track: p.track as number, from: p.bars[0], to: p.bars[1] } : undefined,
  })
  return out
}

/**
 * Theme of Laura came as a text tab with no rhythm written in it. data/songs/theme-of-laura.json
 * is read off the spacing of the tab (tools/tab2json.py), so the lengths are a best guess:
 * `inferred` makes the app say so, and the tempo is whatever feels right against the recording.
 */
const laura = (id: string, name: string, req: string[], from: number, to: number, how: string[]): Item => ({
  id, name, lane: 'songs', fret: 5, kind: 'phrase', req, mins: 5, part: 'la', inferred: true,
  why: 'Theme of Laura. Note lengths are worked out from the spacing of the tab, so check them against the recording.',
  how, src: { song: 'theme-of-laura', track: 0, from, to },
})

const SONGS: Item[] = [
  ...part(
    { id: 'bb-c2', name: 'Bone Bottom: Clean Guitar 2', fret: 1, song: BB, track: 4, bars: [21, 42], start: 40, target: 57,
      why: 'Your first complete part: two three-string shapes, one hit per beat, for twenty bars. It is real music from the record on day one.' },
    [
      ['bb-c2-1', 'Bone Bottom C2: the two shapes', 21, 24, [], [
        'Shape one: index on the high e 12th fret, ring on G 14, pinky on B 15. Shape two: flatten the index across G and e at 12, keep B 15.',
        'One downstroke per click across the three thin strings only.',
        'The change is one finger: the ring finger lifts and the index takes over the G string.',
      ]],
    ],
  ),
  ...part(
    { id: 'bb-c1', name: 'Bone Bottom: Clean Guitar 1', fret: 2, song: BB, track: 3, bars: [1, 42], start: 40, target: 57,
      why: 'The guitar that opens the song and never stops. Slow, exposed, and the best possible training for clean fretting.' },
    [
      ['bb-c1-1', 'Bone Bottom C1: intro, three shapes', 1, 4, ['p-ring', 'f-stretch'], [
        'Four notes climbing, then the last one rings for two beats. That held half-note is your time to move to the next shape.',
        'Bar 2 is the easy one: it ends on the open high string, which rings while your hand travels.',
        'Hold each shape down whole. Nothing is lifted until the bar is over.',
      ]],
      ['bb-c1-2', 'Bone Bottom C1: the low shapes', 16, 19, ['bb-c1-1'], [
        'The same hand shape as bar 4, moved to frets 6, 3 and 5 on the lowest four strings.',
        'Shift during the ringing half-note and keep the fingers in formation while you move.',
      ]],
      ['bb-c1-3', 'Bone Bottom C1: the whole intro', 1, 20, ['bb-c1-2'], [
        'Twenty bars, but only five different shapes. Learn the order: it is the hard part now.',
        'The last note of bar 20 is the pickup into the high section: e string, 18th fret.',
      ]],
      ['bb-c1-4', 'Bone Bottom C1: high pattern', 21, 24, ['f-high', 'p-cross'], [
        'One bar repeated. Index bars the e and B strings at 17, ring finger takes G 19, pinky reaches e 18 at the end of the bar.',
        'Every fourth bar the B string note is 18 instead of 17, once. That is the only change in twenty bars.',
        'Let it all ring.',
      ]],
    ],
  ),
  ...part(
    { id: 'bb-l1', name: 'Bone Bottom: Lead Guitar 1', fret: 4, song: BB, track: 1, bars: [5, 42], start: 40, target: 57, extraReq: ['v-vibrato'],
      why: 'The melody of the song. Nine slow bars where every note is exposed, then sixteen bars of steady eighth notes.' },
    [
      ['bb-l1-1', 'Bone Bottom L1: theme, first half', 5, 8, ['v-bend-half', 'v-slide', 'v-hammer'], [
        'It starts on the "and" of beat 1, after a rest. Count it in.',
        'Bar 5: the third 10 is bent a half step and released, all from one pick stroke.',
        'Bar 7: slide from 10 up to 13 and pull off back to 10.',
      ]],
      ['bb-l1-2', 'Bone Bottom L1: theme, second half', 9, 13, ['bb-l1-1'], [
        'Long notes. Count the full length of each one; rushing them is the usual mistake.',
        'Bar 10 slides down from 8 to 6 on the B string.',
        'Once vibrato is on your Expression string, add it to the whole-note in bar 13.',
      ]],
      ['bb-l1-3', 'Bone Bottom L1: run, bars 24-28', 24, 28, ['p-cross', 'v-grace'], [
        'Strict alternate picking. The pattern is B-string 10, then G-string 7-9-7-9-7-9.',
        'The last note of bars 25 and 26 is the 10 again with a quick half-step bend.',
        'Bar 24 is only the pickup: a grace slide from 10 into 11.',
      ]],
      ['bb-l1-4', 'Bone Bottom L1: run, bars 29-32', 29, 32, ['bb-l1-3'], [
        'The same idea moved onto the D and G strings. Bar 30 has a small stretch down to the 6th fret.',
        'Bars 33-40 repeat bars 25-32 exactly, so this is the last new material in the part.',
      ]],
    ],
  ),
  laura('la-1', 'Laura solo: opening line', ['v-slide'], 1, 3, [
    'Starts on the D string 9th fret, then climbs the G string: 9, 9, 11, 11, 12, 12, 11, 9. Index on 9, ring on 11, pinky on 12.',
    'Bars 2 and 3 move up to the B string. Two notes in the last bar are written together (B 10 with G 9, B 12 with G 9): pluck both at once with thumb and finger, or hold the G string 9 and play the B string on top.',
    'Written in E standard. In D standard the fingering is identical and it sounds a step lower; tune up only to play with the recording.',
  ]),
  laura('la-2', 'Laura solo: the low answer', ['la-1', 'v-hammer'], 4, 7, [
    'Bar 4: A string 7, D string 5, then a slide on the G string from 7 up to 9, then D string 9 and 7.',
    'Bar 5 is the D string walking down: 7, then a hammer-on from 7 to 9, then 5, 4, 5. Pick the 7 and hammer the 9 without picking it.',
    'Bars 6 and 7 start from D string 9, 7 with an A string 7 and a G string 7 mixed in, and finish with a slide from 7 to 9 on the D string.',
  ]),
  laura('la-3', 'Laura solo: answer and chords', ['la-2', 'r-strum'], 8, 11, [
    'Bars 8 to 10 play the low answer again, with a new ending: a G string 4 and a D string 7 together, then G 7 sliding to 9.',
    'Bar 11 is two open E minor chords: first the low four strings (G 0, D 2, A 2, E 0), then all six with the high e on the 2nd fret. Let them ring.',
    'Then three single notes walk down the A string: 4, 3, 2.',
  ]),
  laura('la-4', 'Laura solo: second theme', ['la-1', 'v-hammer'], 12, 15, [
    'D string 7 twice, then the B string: 8, 7, 7, then 7-8-7 in one pick stroke (hammer-on to 8, pull-off back to 7).',
    'It ends on B 5 and G 4. The second time through, the end changes: G string 9, then a jump up to 14, then the high e string 12.',
  ]),
  laura('la-5', 'Laura solo: climbing line', ['la-4'], 16, 21, [
    'One line played three times with different endings. It starts D 7, G 5, then a slide on the G string from 7 to 9.',
    'Then the B string: 8, 10, back to G 9, then B 8, 8, 7 and a slide from 8 to 10.',
    'The third time, the slide 8 to 10 is followed by 10 to 12 and the last note is held.',
  ]),
  laura('la-6', 'Laura solo: bridge', ['la-5'], 22, 29, [
    'The G string 9 is home base. Bars 22 and 23 go G 9, B 10, G 9, G 9, B 12, G 9 and finish on the D string, 10 then 9.',
    'Bars 24 to 26 run the B string 8, 8, 8, 7, 7, 8 and slide 8 to 10, then a D string slide up to 9.',
    'Bars 27 to 29 are the same shapes with a walk down the G string: 9, 8, 8, 6, 8, 9.',
  ]),
  laura('la-7', 'Laura solo: closing arpeggios', ['p-ring'], 30, 35, [
    'Let every note ring. Two groups repeat: A 3, D 2, open G, D 2, then A 5, D 4, open G, D 4.',
    'The third group climbs to A 7, D 5, G 7, then A 7, D 5, and falls back through A 5, D 4.',
    'The last bar is the open E minor chord again, then all six strings.',
  ]),
  {
    id: 'la', name: 'Laura solo: Whole piece', lane: 'songs', fret: 5, kind: 'song', mins: 8, inferred: true,
    req: ['la-1', 'la-2', 'la-3', 'la-4', 'la-5', 'la-6', 'la-7'],
    why: 'A single-guitar melody with no second part to hide behind. Slides, hammer-ons and two open chords.',
    how: ['Play it through with the recording, top to bottom.', 'Written in E standard, so tune up a whole step from D standard for this one.', 'Log it clean only when the whole pass was clean.'],
    src: { song: 'theme-of-laura', track: 0, from: 1, to: 35 },
  },
  ...part(
    { id: 'bw-c1', name: 'Bilewater: Clean Guitar 1', fret: 6, song: BW, track: 3, bars: [1, 72], start: 56, target: 93,
      why: 'Seventy-two bars of ringing eighth-note arpeggios without a break. Simple shapes; the challenge is staying relaxed for three minutes.',
      gear: 'The tab says drop C, but the low string is never played. D standard is fine.' },
    [
      ['bw-c1-1', 'Bilewater C1: intro figure', 1, 5, ['p-ring'], [
        'Three notes: G string 8, B string 11, e string 11, the last held for a beat. Index on 8, ring and pinky on the two 11s.',
        'Bar 5 is a short bar, two beats only, and starts on the D string 11.',
      ]],
      ['bw-c1-2', 'Bilewater C1: four-string roll', 6, 7, ['bw-c1-1'], [
        'D 9, B 11, B 12, e 11. Two notes in a row on the B string: index and middle.',
        'Constant eighths with no gap. Find the picking pattern you can repeat without thinking and never change it.',
      ]],
      ['bw-c1-3', 'Bilewater C1: verse shapes', 11, 14, ['bw-c1-2'], [
        'One note per string, low to high: 9, 11, 12, 11. Then the bass note drops to the A string 11.',
        'The 13 on the A string halfway through bars 12 and 14 is a one-note change. Use the pinky.',
      ]],
      ['bw-c1-4', 'Bilewater C1: verse, second half', 15, 22, ['bw-c1-3'], [
        'Bar 16 lifts the B string note to 14, once. Bars 19-20 move the whole shape up one fret.',
        'From here to bar 62 the part recycles these bars. Learn the order from the full tab.',
      ]],
      ['bw-c1-5', 'Bilewater C1: outro', 63, 70, ['bw-c1-2'], [
        'Four new shapes low on the neck, two bars each. The top two notes are both on the B string.',
        'The last shape uses open strings; let them ring into the held note.',
      ]],
    ],
  ),
  ...part(
    { id: 'bw-c2', name: 'Bilewater: Clean Guitar 2', fret: 7, song: BW, track: 4, bars: [3, 39], start: 56, target: 93,
      why: 'The main melody, played very high on the thin strings in the long-short rhythm. Few notes, all of them exposed.',
      gear: 'Bars 14-15 need the 22nd and 23rd frets. On a 21- or 22-fret guitar, play this phrase an octave lower: same strings, twelve frets down.' },
    [
      ['bw-c2-1', 'Bilewater C2: melody', 3, 6, ['f-high', 't-dotted'], [
        'Starts after a rest of a beat and a half. Count "1 and 2", play on the "and".',
        'All of it sits between frets 16 and 19 on the top two strings.',
      ]],
      ['bw-c2-2', 'Bilewater C2: the high answer', 13, 15, ['bw-c2-1'], [
        'The same start, then a leap to the 22nd fret and a whole-note on the 23rd.',
        'Slide your whole hand up for the leap. Do not stretch for it.',
      ]],
    ],
  ),
  ...part(
    { id: 'lv-effects', name: 'Laura band: Effects Guitar', fret: 8, song: LV, track: 3, bars: [6, 76], start: 60, target: 100,
      why: 'The accompaniment of the band version: open-position arpeggios in eighth notes, never above the 7th fret. The same picking idea as the Bone Bottom clean guitars, with a much smaller stretch.' },
    [
      ['lv-e-1', 'Laura band Effects: intro line', 6, 10, ['p-ring'], [
        'Bar 6 starts on the open B string. Bars 7 and 8 climb the high e string: 0, 0, 2, 2, 3, 3, 2, 0.',
        'Bar 9 jumps to the 7th fret on the high e (7, 7, 5) and then plays B string 5, 5. Bar 10 goes back to 7, 7 and the open high e.',
      ]],
      ['lv-e-2', 'Laura band Effects: the arpeggio', 11, 18, ['lv-e-1'], [
        'Odd bars (11, 13, 15, 17): A 3, D 2, G 0, D 2, D 0, D 4, G 0, D 4. Eight notes, one pick stroke each.',
        'Even bars: D 2, G 0, B 0, B 3, B 0, G 0, D 4. Let every note ring into the next.',
      ]],
      ['lv-e-3', 'Laura band Effects: three-string chords', 27, 34, ['lv-e-1'], [
        'Chords on the top three strings (e, B, G), a half note each: frets 3-5-5, then 2-3-4, then all three open.',
        'Strum them softly or play the three notes together with thumb and fingers.',
      ]],
      ['lv-e-4', 'Laura band Effects: high melody', 35, 41, ['lv-e-3'], [
        'Bar 36 on the high e string: 3, 2, 3, 5, 0. Bar 38 starts the same way with a quick 3-2 turn, then G string 2.',
        'Bar 40 climbs 3, 2, 3, 4, 5, 7 and holds the 7th fret through bar 41.',
      ]],
      ['lv-e-5', 'Laura band Effects: second arpeggio', 42, 58, ['lv-e-2'], [
        'Bar 42 is eight open high e notes. Then two bars alternate until bar 58.',
        'First bar: D 2, G 0, G 2, G 0, D 0, G 0, G 2, D 0. Second bar: A 3, D 2, G 0, A 3, A 2, D 1, D 4, A 2.',
      ]],
      ['lv-e-6', 'Laura band Effects: return', 59, 76, ['lv-e-2'], [
        'A held three-string chord (G open, D 2, A 3) in bars 59 and 60, then the first arpeggio from bars 11 to 18 comes back for the rest of the part.',
      ]],
    ],
  ),
  ...part(
    { id: 'lv-lead', name: 'Laura band: Lead Guitar', fret: 9, song: LV, track: 1, bars: [11, 90], start: 60, target: 100,
      why: 'The melody of the band version. Mostly open strings and the first five frets, with one jump to the 12th fret. Long notes that have to be held their full length.' },
    [
      ['lv-l-1', 'Laura band Lead: theme', 11, 18, ['t-dotted'], [
        'Bar 11: D 2, open G, open B, open high e, back down to B and G 2. Bars 12 to 14 stay on the G, B and D strings between frets 0 and 4.',
        'Bars 15 to 18 repeat the first half and end on the open B string and the open high e string.',
      ]],
      ['lv-l-2', 'Laura band Lead: held chord', 19, 26, ['lv-l-1'], [
        'The open low E string, held. Then a four-string chord, all played at once: high e 2, B 3, open G, D 2.',
        'Leave the chord ringing for the rest of this bar and the whole next one. The two-bar figure repeats four times.',
      ]],
      ['lv-l-3', 'Laura band Lead: second melody', 27, 34, ['lv-l-1'], [
        'A rest, then G 2, G 2, high e 3. Bar 28 plays high e 3 held, 2, 2, 3, 2, and bar 29 lands on the open high e and open B.',
        'Bars 31 to 34 repeat it, but bar 32 reaches the 5th fret and bars 33 and 34 leap up to the 12th fret on the high e.',
      ]],
      ['lv-l-4', 'Laura band Lead: rising line', 35, 40, ['lv-l-3'], [
        'A rest, then G 2, B 1, B 3, e 0, e 3, e 5, e 0, and the open high e held for a whole bar. Played three times.',
      ]],
      ['lv-l-5', 'Laura band Lead: high-string theme', 43, 57, ['lv-l-3'], [
        'High e string: 3, 3, 3, 2, 2, 3, 5, with the 5 held into an open e. Bar 44 then plays open B, e 2, open B; bar 45 ends on the open e.',
        'The three-bar figure plays four times (bars 43 to 57) with a rest bar between each.',
      ]],
      ['lv-l-6', 'Laura band Lead: ending', 77, 90, ['lv-l-2'], [
        'The held-chord figure from bars 19 to 26 returns and the chord rings out until the end of the song.',
      ]],
    ],
  ),
  ...part(
    { id: 'bb-l2', name: 'Bone Bottom: Lead Guitar 2', fret: 8, song: BB, track: 2, bars: [13, 42], start: 40, target: 57, extraReq: ['v-bend-full'],
      why: 'The harmony lead: the theme an octave up at the 17th fret, then a line that weaves under and over Lead 1.' },
    [
      ['bb-l2-1', 'Bone Bottom L2: high theme', 13, 16, ['f-high', 'v-bend-half', 'v-hammer'], [
        'The Lead 1 theme moved up to the high e string at 15-20. Same bend, same rhythm.',
        'Bar 15 reaches the 20th fret with the pinky.',
      ]],
      ['bb-l2-2', 'Bone Bottom L2: high theme, ending', 17, 21, ['bb-l2-1'], [
        'Long notes across the top three strings, 15 to 19. Let each ring its full length.',
      ]],
      ['bb-l2-3', 'Bone Bottom L2: low harmony run', 24, 28, ['p-cross', 'v-grace'], [
        'The partner to the Lead 1 run, on the D string: 8-10-8-10 under the same B-string 10.',
        'Bar 28 drops to the 5th fret across two strings.',
      ]],
      ['bb-l2-4', 'Bone Bottom L2: harmony run, bars 29-32', 29, 32, ['bb-l2-3'], [
        'Stays on the D string and walks up it: 5, 7, 8, 10, 12.',
        'Ends with a grace slide into the 18th fret on the high e: a big jump, so look first.',
      ]],
      ['bb-l2-5', 'Bone Bottom L2: descending run', 33, 36, ['bb-l2-1', 'f-box'], [
        'Two bars that fall from the high e 17 down to the D string, played twice with a different tail.',
        'Three notes per string on the way down, as in the scale drill.',
      ]],
      ['bb-l2-6', 'Bone Bottom L2: last four bars', 37, 40, ['bb-l2-5'], [
        'Bar 37 slides from 15 all the way down, then plays low at frets 5-8. Bar 38 slides back up to 17.',
        'These two slides are the longest shifts in the song. Practise them alone first.',
      ]],
    ],
  ),
  ...part(
    { id: 'bw-l2', name: 'Bilewater: Lead Guitar 2', fret: 9, song: BW, track: 2, bars: [14, 69], start: 56, target: 93,
      why: 'The supporting lead: slow slid melodies, an eighth-note counter-line, and one fast run shared with Lead 1.' },
    [
      ['bw-l2-1', 'Bilewater L2: first melody', 14, 17, ['v-slide', 't-dotted'], [
        'Half-notes on the G string climbing 8, 10, 11, 13, then sliding back down.',
      ]],
      ['bw-l2-2', 'Bilewater L2: double stop and slides', 18, 22, ['bw-l2-1', 'f-high'], [
        'Bars 18-19 are two notes at once: B string 9 with e string 16, then both up two frets. Index and pinky.',
        'Bar 20 slides into and out of the 10th fret in the long-short rhythm.',
      ]],
      ['bw-l2-3', 'Bilewater L2: counter-line', 43, 47, ['p-cross'], [
        'Rest, then three eighths (D 8, G 8, G 10), twice per bar. The rest is part of the riff.',
        'Use one finger laid across both strings at the 8th fret.',
      ]],
      ['bw-l2-4', 'Bilewater L2: climbing eighths', 57, 61, ['bw-l2-3', 'f-box'], [
        'Bar 58 is a straight eighth-note climb across three strings in the scale shape.',
      ]],
      ['bw-l2-5', 'Bilewater L2: the run', 62, 62, ['p-sext'], [
        'One bar, 24 notes, six per beat, palm-muted, climbing the scale shape a third below Lead 1.',
        'Learn it one beat at a time. Each beat is six notes that end on the first note of the next beat.',
      ], { start: 46, own: 4 }],
      ['bw-l2-6', 'Bilewater L2: ending', 65, 69, ['bw-l2-4', 'f-shift'], [
        'Eighth-note climbs in the scale shape, ending on a slide from 14 to 19 on the high e.',
      ]],
    ],
  ),
  ...part(
    { id: 'lv-rhythm', name: 'Laura band: Rhythm Guitar', fret: 12, song: LV, track: 2, bars: [11, 90], start: 60, target: 100,
      why: 'The distorted backing of the band version: two-note shapes on the low strings, never above the 5th fret.' },
    [
      ['lv-r-1', 'Laura band Rhythm: low pairs', 11, 18, ['r-power'], [
        'Bar 11: four eighth notes with a barre across the low E and A strings at the 3rd fret, then four on the open A and D strings.',
        'Bar 12: seven hits on the A and D strings at the 2nd fret, then one open. The pair of bars repeats.',
      ]],
      ['lv-r-2', 'Laura band Rhythm: held lows', 19, 26, ['lv-r-1'], [
        'A whole-note open low E, then a bar of open low E (held), open D, A string 4, A string 3. Repeats four times.',
      ]],
      ['lv-r-3', 'Laura band Rhythm: climbing line', 27, 34, ['lv-r-1'], [
        'A single-note line that climbs the strings: A 3, D 2, G 0 held; D 2, G 2, B 0 held; D 2, G 0, B 0. Bar 30 ends on open G, open B, e 3.',
        'Bars 31 to 33 repeat. Bar 34 plays four short e-string 3s, then 5, 3, 2.',
      ]],
      ['lv-r-4', 'Laura band Rhythm: held shapes', 35, 42, ['lv-r-3'], [
        'Held two-note shapes (D string 2 with the open A string) in bars 35 to 40, repeated three times.',
        'Bar 41 plays quarter-note hits on G 1, D 2, A 2. Bar 42 plays palm-muted eighth notes on the same shape.',
      ]],
      ['lv-r-5', 'Laura band Rhythm: high line', 45, 60, ['lv-r-3'], [
        'High strings: e 3, 2, 3, B 3, e 3, 2 in the first bar and e 0, B 0, e 0, B 4, 2, 4 in the second. The four-bar figure repeats to bar 60.',
      ]],
    ],
  ),
  ...part(
    { id: 'lv-acoustic', name: 'Laura band: Acoustic Guitar', fret: 13, song: LV, track: 0, bars: [2, 10], start: 50, target: 100,
      why: 'Nine bars of four-string chord strums in eighths and sixteenths that open the band version. Short, and good practice for a steady strumming hand.' },
    [
      ['lv-a-1', 'Laura band Acoustic: first strums', 2, 5, ['r-strum'], [
        'Bar 2 is a rest and one quick chord on the last sixteenth: B 1, open G, D 2, A 3.',
        'Bars 3 and 5 play that chord three times, then A 3, D 5, G 5 twice, a sixteenth rest, and a chord of B 3, G 4, D 4, A 5 three times.',
        'Bar 4 changes shape: high e 3, B 5, G 4, D 2.',
      ]],
      ['lv-a-2', 'Laura band Acoustic: repeat', 6, 10, ['lv-a-1'], [
        'The same bars again, ending with the figure from bar 3 played twice in a row.',
      ]],
    ],
  ),
  ...part(
    { id: 'bb-r', name: 'Bone Bottom: Rhythm Guitar', fret: 10, song: BB, track: 0, bars: [25, 42], start: 40, target: 57, gear: LOW_GEAR,
      why: 'Enters at bar 25 with big sustained chords, then turns them into a gallop.' },
    [
      ['bb-r-1', 'Bone Bottom R: held chords', 25, 30, ['r-power'], [
        'One shape on the lowest three strings, moved to frets 0, 2, 4, 2. Let it ring for the whole bar.',
        'The low two strings are open or barred with one finger; the third string is two frets higher.',
      ]],
      ['bb-r-2', 'Bone Bottom R: arpeggio bars', 31, 32, ['p-ring'], [
        'Two bars of single ringing notes across three strings: 5-7-9, then 7-9-11.',
      ]],
      ['bb-r-3', 'Bone Bottom R: gallop', 33, 36, ['bb-r-1', 'r-gallop'], [
        'The chords from bars 25-28, now in the gallop rhythm.',
        'Bars 34 and 36 end with six muted sixteenths in a row. Keep them even.',
      ]],
      ['bb-r-4', 'Bone Bottom R: closing eighths', 37, 40, ['bb-r-3'], [
        'Straight eighth-note chords, all downstrokes, no muting.',
      ]],
    ],
  ),
  ...part(
    { id: 'bw-r', name: 'Bilewater: Rhythm Guitar', fret: 11, song: BW, track: 0, bars: [23, 70], start: 56, target: 93, gear: LOW_GEAR,
      why: 'Octaves under the theme, then the chug-and-release riff that drives the second half.' },
    [
      ['bw-r-1', 'Bilewater R: octaves', 23, 31, ['r-power'], [
        'Whole-note octaves. The skipped string in the middle must stay silent: lean the index back onto it.',
      ]],
      ['bw-r-2', 'Bilewater R: moving octaves', 32, 40, ['bw-r-1'], [
        'Two octaves per bar now: 5, 4, 2, 2, 4, 5 along the second-lowest string.',
      ]],
      ['bw-r-3', 'Bilewater R: muted build', 41, 42, ['bw-r-2', 'p-palm'], [
        'Twelve palm-muted eighths, then the palm lifts for the last four. The lift is the whole effect.',
      ]],
      ['bw-r-4', 'Bilewater R: chug riff', 43, 52, ['r-chug'], [
        'One finger barred across the lowest three strings at frets 4, 2 and 0.',
        'Bar 47 has a short single-note fill at the end. Slow down and learn it separately.',
      ]],
      ['bw-r-5', 'Bilewater R: chug riff, power chords', 53, 62, ['bw-r-4'], [
        'The same rhythm with three-string power chords at 2, 4, 5 and 6.',
        'Bars 61-62 are sixteen muted eighths: stay loose so the tempo does not creep.',
      ]],
      ['bw-r-6', 'Bilewater R: ending', 63, 70, ['bw-r-5'], [
        'Held chords, then a single-note walk down the lowest three strings in bar 66.',
      ]],
    ],
  ),
  ...part(
    { id: 'bw-l1', name: 'Bilewater: Lead Guitar 1', fret: 12, song: BW, track: 1, bars: [8, 71], start: 56, target: 93, extraReq: ['v-bend-vib'],
      why: 'The summit. A singing bent-note theme, a pinch-harmonic solo entrance, and sextuplet runs at 93 bpm. Everything on the neck leads here.',
      gear: 'Bar 65 is a whole-note on the 21st fret.' },
    [
      ['bw-l1-1', 'Bilewater L1: theme', 8, 12, ['v-bend-half', 't-dotted', 'v-hammer'], [
        'B string 11: play it, then bend it a half step and bring it back, all in the long-short rhythm.',
        'Bar 9 has a tiny hammer-on from 9 to 11 just before the third beat.',
        'Ends on a two-bar note. Count all eight beats.',
      ]],
      ['bw-l1-2', 'Bilewater L1: theme, rising ending', 13, 16, ['bw-l1-1', 'f-shift'], [
        'The same opening, but bar 14 slides from 11 up to 15 and back, then lands on 16.',
      ]],
      ['bw-l1-3', 'Bilewater L1: the long bend', 17, 22, ['bw-l1-2', 'v-bend-vib'], [
        'Bar 18 bends the 6th fret a half step, low on the neck where the string is stiffer.',
        'Bars 21-22: bend the 11th fret and hold it for six beats before letting it down. No wobble on the way.',
      ]],
      ['bw-l1-4', 'Bilewater L1: solo entrance', 41, 42, ['v-pinch', 'p-sext'], [
        'A pinch harmonic on B 11, bent a half step and held, then a sextuplet figure across the G and B strings.',
        'Bar 42 walks up the high e (11, 13) and bends 13.',
        'Work out bar 41 one beat at a time before joining anything.',
      ], { start: 46, own: 4 }],
      ['bw-l1-5', 'Bilewater L1: theme with fills', 43, 47, ['bw-l1-1', 'p-sext'], [
        'The theme again, starting from the high e. Bar 47 puts two palm-muted sextuplet fills between the long notes.',
        'The fills are three notes each: D 8, D 11, G 8.',
      ], { start: 46 }],
      ['bw-l1-6', 'Bilewater L1: whole-step bends', 51, 52, ['v-bend-full'], [
        'B string 9, bent a full tone, twice. The second is bent, held and released inside one beat.',
      ]],
      ['bw-l1-7', 'Bilewater L1: sextuplet licks', 55, 56, ['p-sext'], [
        'A held 16, then six fast palm-muted notes climbing back up to it, twice. Bar 56 does the same aiming at 18.',
        'Bar 56 ends with a full bend on the high e 16.',
      ], { start: 46, own: 4 }],
      ['bw-l1-8', 'Bilewater L1: the run', 62, 62, ['bw-l1-7', 'bw-l2-5'], [
        'Twenty-four notes in one bar: the scale shape climbing in overlapping groups, palm-muted until the top.',
        'You already know the Lead 2 version. This is the same pattern a third higher.',
      ], { start: 46, own: 4 }],
      ['bw-l1-9', 'Bilewater L1: ending', 63, 71, ['f-shift', 'v-bend-full'], [
        'Long notes high on the e string: 18, 15, 17, 18, 20, a full bend on 20, then 21.',
        'The song ends on a half-step bend at 17 that hangs. Hold it in tune until it dies.',
      ]],
    ],
  ),
  ...part(
    { id: 'mk-l', name: 'Mantis Lords: Lead Guitar', fret: 17, song: MK, track: 0, bars: [2, 44], start: 40, target: 95, extraReq: ['p-sext'],
      gear: 'Written on a 7-string, but this part never uses the lowest string: the top six are plain E standard. Tune up a whole step from D standard (or play it in D standard, a step lower). Bar 37 reaches the 22nd fret: leave those notes out if your neck ends sooner.',
      why: 'Mostly six notes to a beat at 95 bpm, with big position jumps and hammer-ons. The hardest thing in the course. Expect months, and expect it to stay in rotation. That is normal.' },
    [
      ['mk-l-1', 'Mantis Lords Lead: intro riff', 2, 3, ['p-sext', 'f-high', 'v-hammer'], [
        'Alternate picking on the G string: a high note, then fret 5, every other note. The high notes go 17, 13, 12, 13, 12, 10, 12, 10.',
        'The end of each bar adds hammer-ons from 5 to 8 and 5 to 7. Bar 3 finishes with a slide from 5 to 10, then 10, 12 and B string 9, 10, 11, 12.',
        'Start far below tempo. Six notes to a beat is the speed this whole song is built on.',
      ], { own: 4 }],
      ['mk-l-2', 'Mantis Lords Lead: descending pairs', 4, 6, ['mk-l-1'], [
        'Each note is played twice. Bar 4 walks down the B string 9, 8, 6 then the G string 8, 7. Bar 5 continues G 5 and the D and A strings with palm muting.',
        'Bar 6 ends on six repeats each of D 4, D 5 and G 4.',
      ], { own: 4 }],
      ['mk-l-3', 'Mantis Lords Lead: theme', 7, 10, ['mk-l-2', 't-triplet'], [
        'Bar 7 is the main theme in eighth-note triplets (three to a beat): B 13, G 13, 12, 13, rest, 12, 10, 13, rest, 12. Bar 8 moves along the B string between frets 12 and 16.',
        'Bars 9 and 10 play that shape as pairs on frets 12 to 16 across the B and high e strings.',
      ], { own: 4 }],
      ['mk-l-4', 'Mantis Lords Lead: verse riff', 11, 17, ['mk-l-3', 'p-palm'], [
        'Bars 11 and 12 are triplets at frets 3 to 8 on the G and D strings, with palm muting on the repeated notes.',
        'Bar 13: palm-muted pairs of G 5, D 6, G 5, then G 7, G 8, B 8. Bars 14 to 17 move that figure around. Bar 14 is a short two-beat bar.',
      ], { own: 4 }],
      ['mk-l-5', 'Mantis Lords Lead: run', 18, 19, ['mk-l-4'], [
        'Bar 18: palm-muted G 12 with a hammer-on to 13 on every beat. Bar 19 is a 24-note run climbing in threes up the G, B and high e strings, finishing with a slide to 18.',
      ], { own: 4 }],
      ['mk-l-6', 'Mantis Lords Lead: second theme', 20, 26, ['mk-l-3'], [
        'Eighth-note triplets on the B and G strings (13, 13, 12, 13, 12) played three times, each a little lower (bars 20 to 22). Bars 24 and 25 move it to frets 10 to 14.',
        'Bar 26 plays two strings at once: e 13 with G 10, then 14 with 11, 16 with 13, 14 with 11.',
      ], { own: 4 }],
      ['mk-l-7', 'Mantis Lords Lead: build', 27, 37, ['mk-l-6'], [
        'Bar 27 hits D 12 with G 11. Bars 28 and 29 repeat each note six times, a whole beat per note: G 10, 11, 13, 11, then G 11, G 12, B 10, B 11.',
        'Bars 30 to 32 are the triplet theme walking down the strings. Bar 33 is a palm-muted run climbing the D, G and B strings.',
        'Bars 34 and 35 return to the theme at frets 11 to 16. Bar 36 is three-string stabs (G 13, B 15, e 16), and bar 37 slides them up to 19, 21 and 22.',
      ], { own: 4 }],
      ['mk-l-8', 'Mantis Lords Lead: return and ending', 38, 44, ['mk-l-1'], [
        'The intro riff comes back in bars 38 and 39, then pairs run down the high strings (bars 40 to 42).',
        'The song ends on a held two-note chord, B 4 with G 5.',
      ], { own: 4 }],
    ],
  ),
  ...part(
    { id: 'mk-r', name: 'Mantis Lords: Rhythm Guitar', fret: 18, song: MK, track: 1, bars: [2, 44], start: 40, target: 95,
      gear: 'Written for a 7-string guitar: it plays the lowest string (a B) in most bars. It cannot be played as written on a six-string. Take it out of rotation, or leave it for the day you have a 7-string.',
      why: 'A palm-muted gallop on the lowest string with chord stabs on top. It is here for completeness: it needs a 7-string guitar.' },
    [
      ['mk-r-1', 'Mantis Lords Rhythm: intro stabs', 2, 5, ['r-gallop', 't-triplet'], [
        'A three-string stab (low B 1, E 3, A 3), a rest, then palm-muted bursts of six on the low B string at fret 1.',
        'Bar 4 holds the chord. Bar 5 plays four palm-muted chords, then E 4 with A 6 and E 1 with A 3.',
      ], { own: 4 }],
      ['mk-r-2', 'Mantis Lords Rhythm: low gallop', 6, 10, ['mk-r-1'], [
        'Each beat is six palm-muted repeats of one note: low B 3, then E 3 (bar 6); E 1, then low B 4 (bar 9); low B 3 (bar 10).',
      ], { own: 4 }],
      ['mk-r-3', 'Mantis Lords Rhythm: descending pedal', 11, 19, ['mk-r-2'], [
        'Bars 13 to 17: a pedal note on the E string, two beats each, falling 13, 11, 10, 8, 7, 4, 3, 2.',
        'Bars 18 and 19 are an eighth-note triplet line across the G, D and A strings from fret 10 down to 2.',
      ], { own: 4 }],
      ['mk-r-4', 'Mantis Lords Rhythm: chug and stab', 20, 29, ['mk-r-3'], [
        'A chord stab, then palm-muted sextuplets on the A string at fret 3, then 2, 1 and 0 (bars 20 to 23). Bars 24 and 25 stay on one note.',
        'Bars 26 and 27 stab two strings at once. Bars 28 and 29 are palm-muted triplets on the E and A strings: 7 and 9, then 3 and 5.',
      ], { own: 4 }],
      ['mk-r-5', 'Mantis Lords Rhythm: stabs and ending', 30, 44, ['mk-r-4'], [
        'Spaced triplet stabs in bars 30 to 32, a single-note line in bar 33, four stabs a bar in bars 34 to 36, then the intro figure again to the end.',
      ], { own: 4 }],
    ],
  ),
]

/** Course order: technique by fret, then the songs in the order they open up. */
export const ITEMS: Item[] = [...DRILLS].sort((a, b) => a.fret - b.fret).concat(SONGS)
export const ITEM_BY_ID: Map<string, Item> = new Map(ITEMS.map((it) => [it.id, it]))

/** The phrases (and nothing else) that belong to a song part, in order. */
export const phrasesOf = (partId: string): Item[] => ITEMS.filter((it) => it.part === partId)
export const PARTS: Item[] = ITEMS.filter((it) => it.kind === 'song')
