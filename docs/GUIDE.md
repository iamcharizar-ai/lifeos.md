# The system: how it all works, and why

Six small apps and one shared ledger. This guide explains what each part does, how they talk to each other, how the game on top works, why it was designed this way, and what comes next.

Written 2026-10-03. Rules version 1.

---

## 1. The idea in one minute

- **Life OS** is the only place you run your day. You tick habits there.
- Three habits are too big for a tick, so each has its own app that decides what to do today and reports back: **Strong** (gym), **Arbor** (calisthenics skills), **Woodshed** (guitar).
- **Pokedex** is the reward layer. It turns the work into one partner that levels up and evolves, and a collection that grows. You never do anything in Pokedex; it only shows what Life OS earned.
- All five read and write one append-only list of events (the **ledger**). Nothing else is shared, and nothing is stored about the game: it is recomputed from the ledger every time.

The one rule behind every design choice: **the only way to progress is to do the day.**

---

## 2. The apps

| App | What it is for | What it decides for you | Where |
|---|---|---|---|
| Life OS | The daily checklist, the month graph, the Sunday reset | Nothing. It is the list. | redesign-life-os-ui.vercel.app |
| Strong | Logging the gym session | Today's routine (seven-day split) and the next weight (double progression) | strong-five.vercel.app |
| Arbor | The calisthenics skill tree | Which skills to practise this morning and which to add at the gym | arbor-umber.vercel.app |
| Woodshed | Guitar practice | Today's practice session, one new thing at a time | woodshed-sooty.vercel.app |
| Pokedex | Progress and collection | Nothing. It is a mirror. | pokedex-theta-swart.vercel.app |
| Vitals | Sleep, steps, weight, and the band's readings later | Tonight's bedtime | vitals-theta-pied.vercel.app |

LeetCode (Striver's sheet) has no app on purpose. You track the sheet where it already lives and tick one habit in Life OS.

### Why separate apps and not one

Each one is a different kind of tool: a logger, a tree, a tab reader, a checklist. Merged, each would be buried under the others' screens. Separate, each opens straight onto the one thing it is for. The cost of separation (having to open four apps) is removed by the links below: most days you only open Life OS and Strong.

---

## 3. How they are linked

### The ledger

One table (`events`) in Supabase. Every row is something that happened:

```
device   who wrote it
at       when (the writer's clock)
day      which day it belongs to (YYYY-MM-DD)
type     what kind of thing
payload  the details
```

Rows are only ever added, never changed. Each app reads the rows it cares about and rebuilds its own state from them ("folding"). Two consequences:

- **Phone and desktop cannot disagree for long.** They fold the same rows.
- **Nothing can be lost by a bad sync.** There is no "state" to overwrite, only history to replay.

### Who writes what

| Event | Written by | Read by | Meaning |
|---|---|---|---|
| `tick` / `untick` | Life OS | Life OS, Pokedex | a habit was ticked or un-ticked |
| `config` | Life OS | Life OS, Pokedex | the whole habit library, each time it changes |
| `workout` / `workout_clear` | Strong | Life OS, Pokedex | a gym session was finished or deleted |
| `routine`, `workout_delete` | Strong | Strong | routines and history, synced between your devices |
| `skill` | Arbor, Life OS, Strong | Arbor, Life OS, Strong, Pokedex | a skill was practised (optionally with a new best) |
| `plan` | whichever app opens first that day | Arbor, Life OS, Strong, Pokedex | today's Arbor skills, frozen for the day |
| `guitar` | Woodshed, Life OS | Woodshed, Life OS, Pokedex | a practice item was logged |
| `guitar_plan` | whichever app opens first | Woodshed, Life OS, Pokedex | today's Woodshed session, frozen for the day |
| `vitals` | Vitals (by hand now, the band later) | Vitals, Life OS, Pokedex | one day's body readings |
| `month`, `sunday`, `metric`, `health` | Life OS | Life OS | sealed months, the Sunday list, manual numbers |

"Frozen for the day" matters: the coach's pick for today is published once, so the phone, the desktop and Strong all show the same skills, and it does not reshuffle halfway through the day.

### Linked habits in Life OS

Four habits are fed by other apps and wear those apps' looks:

- **Gym** is ticked by Strong. Finishing a workout writes a `workout` event; Life OS ticks Gym from it. Once the first Strong workout has ever come through, Gym can no longer be ticked by hand. Until then it can, so you are never locked out before the link is proven.
- **Arbor skills** opens into the skills the coach picked. You tick each one in Life OS (type a number first to log a new best). The habit ticks itself when all are done.
- **Woodshed** opens into today's session. You log each item with how it felt. The habit ticks itself when the session is done.
- **The partner card** at the top is the Pokedex's window into Life OS.

### The shared cores

Logic that two apps must agree on lives in one place and is copied, never rewritten:

| Core | Source of truth | Copied into | What it holds |
|---|---|---|---|
| `arbor-core` | arbor repo, `core/` | Life OS, Strong | skill list, the coach, the gym schedule, pixel figures |
| `woodshed-core` | woodshed repo, `core/` | Life OS | the course, the coach |
| `game-core` | pokedex repo, `core/` | Life OS | XP rules, levels, the fold that produces the partner |

After changing a core, run `npm run core` in its home repo. It copies the files into the others. Never edit a copy.

---

## 4. A day, end to end

1. **Morning, Life OS.** The chain (freshen up, make bed, brush...) is one tap each. The Arbor block shows five skills chosen to avoid whatever the gym trains tonight. Tick them as you do them.
2. **Any time, LeetCode.** One tick. It is worth as much as the whole gym session.
3. **Evening, Strong.** Home shows today's routine and any Arbor add-on that needs gym equipment. Finish the workout: Gym ticks itself in Life OS.
4. **Evening, Life OS.** Open the Woodshed block, log the session. Tick the night routine.
5. **Every tick** moves the partner's XP bar. Level-ups, evolutions and catches are announced once, in a small card above the tab bar.
6. **If every habit on the list is ticked**, the day is perfect and a new one joins the queue.

---

## 5. The game

### One partner, one bar

There is exactly one active partner. Every XP you earn goes to it. You never assign anything to anything. When it is fully trained it moves into the Pokedex for good, and the next one in the queue (oldest catch first) takes over. If the queue is empty, an egg hatches, so the loop never stalls.

The first partner is Charmander.

### XP

| Tier | XP | Which habits |
|---|---|---|
| Pillar | 100 | LeetCode, Gym, Woodshed |
| Core | 30 | Arbor skills, Sleep At 10 |
| Standard | 3 | Plan, skincare, meds, isabgol, protein, pancake stretch, the drive |
| Basic | 1 | every routine chore |

- A full day is about 405 XP. The three pillars are roughly three quarters of it. The whole routine together is worth less than half a pillar: enough that it is not zero, never enough to level on.
- **Blocks pay for the share done.** Three of five Arbor skills pays 60% of 30. Two of four Woodshed items pays 50 of 100.
- **A tick counts if it was made by the end of the next day.** Filling in last week does nothing.
- The tier of a habit is editable in Life OS (the ⋯ on its row).

### Momentum

A day "counts" when two or more pillars were done. Momentum looks at the previous seven days:

| Counting days of the last 7 | Multiplier |
|---|---|
| 0 to 2 | ×1.0 |
| 3 or 4 | ×1.2 |
| 5 or 6 | ×1.35 |
| 7 | ×1.5, and the Mega form |

It looks backwards, so you know today's multiplier the moment the day starts. One missed day slides it down a step. It never resets to zero.

### Levels and evolution

Total XP needed for level L is 6 × L².

| Line | Evolves at | Fully trained at |
|---|---|---|
| Three stages | 16 and 36 | 50 |
| Two stages | 25 | 50 |
| One stage | never | 30 |

| Milestone | Total XP | Full days (405) | Ordinary days (about 200) |
|---|---|---|---|
| First evolution, level 16 | 1,536 | 4 | 8 |
| Final evolution, level 36 | 7,776 | 19 | about 39 |
| Fully trained, level 50 | 15,000 | 37 | about 75 |

With momentum at full the numbers shrink by a third. Expect five to nine fully trained partners a year. XP past the last level carries into the next partner.

Every evolution method from the games (stones, trading, friendship) is replaced by these levels.

### Special forms

All automatic. Each is decided by what you did, never by a menu.

- **Branching evolutions** (Eevee, Poliwhirl, Kirlia, Gloom...). Each branch stands for something: Code, Gym, Guitar, Arbor, Sleep, Routine. At the evolution level, the branch you did best on since the last evolution wins ("best" means the share of what was possible, so a small habit done every day can beat a pillar done half the time). Ties are broken by a roll fixed to that day. Eevee has eight: Jolteon for Code, Flareon for Gym, Sylveon for Guitar, Leafeon for Arbor, Umbreon for Sleep, Vaporeon for Routine, Espeon for doing all three pillars evenly, and Glaceon reserved for the health tracker. The branches you did not get stay dark in the Pokedex, which is a reason to raise the same species again.
- **Mega forms.** Temporary, as in the games. While momentum is full (all seven previous days counted), a fully evolved partner that has a Mega shows it, and it is registered in the Pokedex. When there are two (X and Y): X if the gym led the week, Y if code or guitar did. It drops back when momentum drops.
- **Gigantamax.** A fully evolved partner that has one shows it for the day on a perfect day.
- **Bond.** A partner that never dozed off (see below) from the day it became your partner to the day it is fully trained gets a Bond ribbon.
- A species without a Mega or Gigantamax form gets a coloured frame on those days instead, so the moment always shows.

### Catching

Only a **perfect day** catches: every habit on that day's list ticked, in time. Each perfect day adds one first-stage species from the open regions to the queue. The roll is fixed by the date, so every device sees the same one. New lines come before repeats.

Perfect days are counted for life and never reset:

- every 5th is a rare,
- every 10th is a shiny,
- every 25th is a legendary.

### Regions

Kanto at the start. Every two fully trained partners open the next: Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar, Paldea. A region decides which species can turn up. All nine are in: 569 lines, 1,066 species and variants, plus 102 Mega and Gigantamax forms, all from the same pixel-style sprite set. The first five regions are fully animated; from Kalos on, some are still images (most of Paldea is).

**Regional variants** (Alolan, Galarian, Hisuian, Paldean) are lines of their own that turn up once their region opens. An ordinary species never evolves into a variant, so a few variants that only exist as a later stage (Alolan Raichu, Hisuian Typhlosion) are not in.

### Sleep and badges

- **Dozing.** After two days in a row with no pillar at all, the partner is shown asleep until the next pillar. It costs nothing except the Bond ribbon. This is "never miss twice" made visible.
- **Badges.** A Monday-to-Sunday week with five counting days earns a badge. The partner card shows the week's count.

### Deliberately left out

Money, a spendable currency, a shop, skip or freeze tokens, penalties, leaderboards, and any reward for merely opening the app. Each of these either lets you buy your way past the work or rewards the wrong behaviour.

---

## 6. Why it is built this way

### The book

The system follows the four laws from *Atomic Habits*.

| Law | Where it shows up |
|---|---|
| Make it obvious | One checklist, in the order the day happens. The coaches remove "what should I do?": Arbor, Woodshed and Strong each open on today's answer. |
| Make it attractive | The partner. Its bar moves on every tick, and the next evolution is always a visible number of XP away. |
| Make it easy | Linked habits tick themselves. No assigning, no choosing, no second app to open for Arbor or guitar. |
| Make it satisfying | An immediate, small signal on every tick (the bar), a bigger one now and then (level, evolution), a rare one (catch). |

And three ideas from it that shaped specific rules:

- **Every action is a vote for the person you want to be.** XP is only ever added. Nothing in the game goes down, and nothing is taken away.
- **Never miss twice.** Momentum slides instead of resetting, and the partner only dozes after two empty days. One bad day is absorbed; a second is the signal.
- **Rewards must match the identity.** That is why there is no cheat-day shop and no money: a reward that undoes the habit teaches the opposite.

### Your decisions, and what they say

- **Gym cannot be ticked by hand.** You wanted the tick to mean the work happened. The game follows the same principle: XP counts for a day only if the tick was made in time.
- **Coaches decide; you do.** You asked Arbor and Woodshed to pick the day's work so you never have to. The game makes no demand for decisions either: one partner, automatic queue, automatic branches.
- **Everything visible in Life OS, nothing extra.** You did not want to open Arbor separately. The Pokedex is the same: one card in Life OS, the rest elsewhere.
- **Catching only on a perfect day.** You chose to keep catching rare so that raising the partner is the daily aim. The egg rule exists so that this strictness never leaves you with nothing to raise.
- **Routine pays little, but not zero.** Your words: if it paid nothing, you might not do it.
- **No set types, no rest timer, no merged apps.** Each tool does one thing.

### Why the game is recomputed and not saved

The partner, the queue and the collection are worked out from the ledger each time. Nothing about the game is written anywhere. That is why Life OS and Pokedex always agree, why a second device needs no setup, and why a bug in the game can be fixed without repairing saved data.

The price: changing a rule changes history. So rule changes get a version number and a date (see section 9).

---

## 7. What is weak today

Worth knowing, in order of how much it matters:

1. **Nothing pulls you back after the morning.** Evening habits are ticked far less than morning ones. The game adds a reason to come back; a timed evening reminder would add a cue.
2. **A perfect day needs every habit on a long list.** Catches will be rare until the list is shorter or the evening gets ticked. Trimming the chore list is the lever.
3. **The gym plan is seven days a week.** If that is not what happens, the plan should change before the game does.
4. **The ledger has no login.** Anyone who has the site's key can read and add events. Fine for a private toy; the first thing to fix before anything sensitive (health data) goes in.
5. **The habit library is saved whole on every edit.** Hundreds of full copies. It needs compacting eventually.
6. **Arbor still carries non-calisthenics branches** (kicks, flips, breaking, dance), programme entries, orphan skills and a few wrong prerequisites.
7. **Deleting a habit can change past days.** A day that was one tick short becomes perfect if the missing habit is deleted. Rare, but real.
8. **Cores are copied by script.** If a copy step is skipped, two apps drift.
9. **Woodshed deploys by hand**; the others deploy from GitHub.

Not built yet, though described in the plan: choosing the partner by hand in Pokedex (the queue order is always automatic).

---

## 8. The health tracker (the plan; section 11 says what exists now)

You plan to add a Fitbit Air and build an app on Google's health API (the `ghealth` command-line tool reads the same data). The band measures heart rate, heart-rate variability, blood oxygen, breathing rate, skin temperature, sleep stages and score, cardio load and readiness.

### What is already prepared

- **Pillars are a list.** `rules.ts` maps habit ids to what they stand for. A measured Sleep pillar is one more line.
- **A reserved event.** The health app should write one `vitals` event per day:

```
{ bedtime, wake, sleepMin, sleepScore, steps, activeMin,
  restingHr, hrv, readiness, cardioLoad, weight }
```

- **A reserved branch.** Glaceon waits for it.

### What it will add

1. **Sleep as a measured fourth pillar.** "Sleep At 10" ticked and locked by the band, the way Gym is by Strong.
2. **Trainer stats.** Six numbers on a radar chart, each a level against your own baseline: HP from sleep, Attack from strength (Strong's lifts), Defense from recovery (HRV, resting heart rate), Sp. Atk from code, Sp. Def from guitar, Speed from cardio. Three of these can be computed today.
3. **Eggs that hatch on real steps** instead of hatching at once.
4. **Checks.** Weigh-in from the scale, an exercise session confirming Gym.
5. **Readiness for the coaches.** Arbor and Strong lightening a session on a low-readiness morning. This changes the plan, not the XP.

### The rule to keep

**Pay XP for what you control; only display what you do not.** Bedtime, steps and sessions are behaviours. HRV, sleep score and readiness are outcomes. Paying for a score turns one bad night into a punishment and invites chasing the number instead of the habit.

### One technical constraint

A web page cannot run a command-line tool or hold a Google sign-in safely. The health app needs a small scheduled job (a server function, or a task on the PC) that signs in, reads the day and writes the `vitals` event. And the ledger needs a login before health data goes into it.

---

## 9. Changing things

### Where the numbers live

Every number in the game is in `core/rules.ts` in the pokedex repo: tier XP, momentum steps, the level curve, evolution levels, catch odds, region and badge rules. Change it there, then:

```
npm test          # in pokedex: the game's rules as tests
npm run core      # copies core/ into lifeos/src/game-core
```

Then deploy both. If a change affects past days, bump `RULES_VERSION` and note the date here.

| Version | From | What changed |
|---|---|---|
| 1 | 2026-10-03 | first rules |

### The species table

`core/species.ts` is generated: names, numbers, evolution links, regions, rarity, what each branch stands for. `npm run species -- <path to the unpacked sprite folder>` rebuilds it and copies only the sprites in use into `public/sprites/`.

### Sprites

They live only in the pokedex repo (private) and are served by the Pokedex site. Life OS loads them by address (`VITE_POKEDEX_URL`). The Life OS repo, which is public, contains none.

### Settings each app needs

| Setting | Apps | What it is |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | all five | the ledger |
| `VITE_POKEDEX_URL` | Life OS | where sprites and the Pokedex link point |
| `VITE_WOODSHED_URL` | Life OS | the Woodshed link |
| `VITE_SUPABASE_DISABLE=1` | all, in development | run without touching the real ledger |

### Testing without touching real data

Run any app with `VITE_SUPABASE_DISABLE=1`, or point it at a local stand-in for the ledger. Never test against the real one: every test tick becomes part of your history.

---

## 10. Words used here

- **Ledger**: the shared list of events.
- **Fold**: rebuilding state by replaying events.
- **Pillar**: a habit worth 100 XP. Today: LeetCode, Gym, Woodshed.
- **Counting day**: a day with two or more pillars done.
- **Momentum**: the multiplier from counting days in the last seven.
- **Perfect day**: every habit on that day's list ticked in time.
- **Partner**: the one being raised now.
- **Queue**: caught, waiting their turn.
- **Fully trained**: reached the last level and moved into the Pokedex for good.
- **Core**: shared logic copied between apps.

---

## 11. Vitals: what exists now

Vitals is live and linked, but nothing depends on it. Until you start using it (or until the band arrives), the rest of the system behaves exactly as before.

### What it is

A dark, tile-based app laid out like Samsung Health, which was studied screen by screen first (the study is in the vitals repo, `docs/SAMSUNG-HEALTH-STUDY.md`). Three levels: a home of tiles, one tracker per metric, a trend chart.

- **Home**: categories (Favourite, Activity, Sleep, Vitals, Body), a swipeable insight card, tiles. Dark tiles show live numbers; coloured ones are readings that need the band.
- **Trackers** for sleep, steps and body composition, all on one template: day picker, one big number, the last seven days with an average line, something specific (bedtime guidance and a consistency grid; a month calendar; normal-range bars), then "enter data".
- **Trends** over 30 days, 12 weeks or 12 months.
- **My page**: a weekly report against the week before, badges, personal bests.
- **Quick add**: sleep, steps and weight from one button.

Everything can be typed in by hand today. A reading that was not taken shows as dashes or a gap, never as zero.

### Bedtime guidance

Tonight's time is your usual bedtime over the last week, moved half an hour earlier, and never earlier than your goal. It needs three logged nights. The idea: a goal four hours away produces a week of misses; half an hour produces a week of wins.

### How it is linked

| Link | What happens | What it does not do |
|---|---|---|
| Vitals → ledger | Each reading is a `vitals` event, in the same table as everything else | |
| Vitals → Life OS | A measured bedtime of 22:30 or earlier ticks that evening's "Sleep At 10" | It never un-ticks and never locks: you can still tick by hand, and days with no reading are untouched |
| Vitals → Pokedex | The same sleep rule feeds the game, and a "Body" line appears on the partner screen with the newest readings | No new XP and no new rules. With no Vitals data the line is simply absent |
| Life OS → Vitals | A link in the footer | |

So the only thing Vitals can change today is one habit tick, and only in your favour.

### What is not built

- **The band sync has never run for real.** `tools/sync.mjs` reads Google Health through the `ghealth` tool and writes `vitals` events. It is tested against the documented shapes only. It needs Go installed, a Google Cloud project and a sign-in. A few field names (variability, blood oxygen, skin temperature) are best guesses.
- **No measured Sleep pillar.** Sleep is still a 30 XP core habit.
- **No trainer stats, no eggs on steps.**
- **Goals live on each device.** The bedtime and step goals you set in Vitals are not shared; Life OS uses a fixed 22:30.

---

## 12. What you can do with it all linked

A realistic picture of the system at full use.

- **One screen runs the day.** Life OS in the morning; four of its habits fill themselves in: Gym from Strong, Arbor skills and Woodshed from their blocks, Sleep from Vitals.
- **Nothing to decide.** Arbor picks the morning skills around tonight's gym session. Strong picks the routine and the next weight. Woodshed picks the practice session. Vitals picks tonight's bedtime. They choose; you do.
- **One number that means something.** Every tick moves one partner. Code, gym and guitar carry it; routine keeps it from being zero.
- **Honest ticks.** Gym cannot be faked once Strong is in use. Sleep cannot be faked once the band is. Late ticks do not count.
- **A record you can read back.** Pokedex's journal, Strong's lifts and muscle charts, Arbor's tree, Woodshed's tempos, Vitals' trends and weekly report: the same weeks, seen five ways.
- **Two devices, no setup.** Open any app on any device and it rebuilds itself from the ledger.

What it cannot do yet: remind you of anything, notice a bad week and say so, or adapt a plan to how you slept.

---

## 13. What is left

In the order I would do it.

### Before the band

1. **Give the ledger a login.** It is the one real weakness, and body data can now go into it. Every app reads and writes with a key that ships in the page.
2. **Rethink "Sleep At 10".** Your nights currently start around 2 am. As a fixed habit it blocks every perfect day. Options: make it follow tonight's Vitals bedtime, or change its time.
3. **An evening reminder.** Almost nothing after midday gets ticked. One notification at a fixed time is the cheapest fix in the whole system.
4. **Trim the routine list.** A perfect day needs every habit; 33 is a lot.
5. **Use Strong once.** It has never recorded a workout, so the Gym lock has never engaged and the link is unproven in real use.

### When the band arrives

6. Install Go, build `ghealth`, run `ghealth setup`, then `node tools/sync.mjs --dry-run` in the vitals folder and fix any field names that come back empty.
7. Schedule the sync (a daily task on the PC is enough).
8. Make Sleep a measured pillar: worth 100, locked like Gym.
9. Trainer stats on a radar in Pokedex: sleep, strength, recovery, code, guitar, cardio.
10. Eggs that hatch on real steps.
11. Share goals through the ledger so every app agrees on bedtime and step targets.

### Whenever

12. Clean Arbor: move the non-calisthenics branches out, fix the wrong prerequisites, connect the orphans.
13. Compact the habit-library history (hundreds of full copies).
14. Let Strong edit a past workout.
15. Connect Woodshed's deploys to GitHub like the others.
16. Choosing the partner by hand in Pokedex (the queue is automatic today).
17. One shared package for the cores instead of copy scripts.

---

## 14. Further out

Ideas, not plans.

- **Readiness for the coaches.** A low-recovery morning makes Arbor and Strong offer a lighter session. Changes the plan, never the XP.
- **A weekly review that writes itself.** Sunday: what moved, what slipped, one suggestion. All the data is already there.
- **Compare lines.** Samsung Health overlays one reading on another's timeline. Sleep against gym days, or bedtime against next-day LeetCode, would show what actually helps.
- **A sleeper type and a multi-week programme**, the way Samsung's sleep coaching does it, built on the bedtime steps.
- **Nutrition**, if it ever earns its place: protein against a target is the one number worth having.
- **Widgets.** The partner, tonight's bedtime and today's routine on the phone's home screen.
- **An export.** Everything is in one table; a yearly summary is a query away.

The rule for adding anything: it must either remove a decision or make a real thing more visible. If it only adds a screen, leave it out.
