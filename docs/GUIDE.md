# The system: how it all works, and why

Six small apps and one shared ledger. This guide explains what each part does, how they talk to each other, how the game on top works, why it was designed this way, and what comes next.

Written 2026-10-03, last revised 2026-10-08. **The game runs rules version 6 from 8 Oct 2026. The section "Rules version 6" and then "The game today" below are current; sections 5 and 15 are the earlier versions, kept as history.**

---

## 1. The idea in one minute

- **Life OS** is the only place you run your day. You tick habits there.
- Three habits are too big for a tick, so each has its own app that decides what to do today and reports back: **Strong** (gym), **Arbor** (calisthenics skills), **Woodshed** (guitar).
- **Pokedex** is the reward layer. It turns the work into one partner that levels up and evolves, and a collection that grows. You never do anything in Pokedex; it only shows what Life OS earned.
- All five read and write one append-only list of events (the **ledger**). Nothing else is shared, and nothing is stored about the game: it is recomputed from the ledger every time.

The one rule behind every design choice: **the only way to progress is to do the day.**

---

## Rules version 6 (from 8 Oct 2026): an economy with a reason for each thing

Version 6 starts on the same day version 5 did, so 5 never ran a day alone. It replaces the money rules of 5 and keeps everything else. The full design, with the reasoning, is `ECONOMY-V6.md` in the workspace folder.

**What changed and why.** In version 5 a coin was one per XP, and the shop sold "take HP off the wild Pokemon", which is what the day's work already does. That was a closed loop with no decision in it, and nothing could be given for a streak or a record. Now:

| Piece | Earned by | Used for |
|---|---|---|
| Coins | daily and weekly quests, the season, chests, selling a Box Pokemon to the Professor. **Not from XP** | the Mart: three deals a day, one of each (balls, berries, lures) |
| Gems | feats, a catch, an evolution, a badge, a graduation, weekly quests | Mystery Egg, Full Incense, chests, scene themes. Never a ball |
| Marks | one a day for each kind of work done (coding, gym, guitar, Arbor, good sleep); +2 per personal record, +3 per song part owned | that kind's own shop: Silph Co., the Dojo, Music Hall, the Farm, Dream House |
| Shards (red, blue, yellow, green) | feats only | three forge a Mega Stone for one Pokemon |
| Feats | runs of days (one rest day forgiven) and lifetime totals: 60 of them | gems, shards, and the items no shop sells: Key Stone, Master Ball, Amulet Coin, Exp. Share, Life Orb, the held items that strike x1.3 |

Balls now have conditions: a Net Ball hits Water and Bug double, a Quick Ball is best on the day the wild Pokemon appears, a Timer Ball grows each day it waits, a Repeat Ball likes a species you own. A Pokemon can carry three TMs, each counting as one of its types against a leader, and hold one item that makes one kind of work strike harder. A lure makes the next wild Pokemon one of a domain's types.

**Mega, rebuilt.** The eighth badge no longer hands over the Key Stone and every Mega. The Key Stone is a feat (seven days running on any one kind of work). A Mega Stone is forged on the Pokemon's own page from three shards: red for X forms, blue or yellow for Y forms. So the Mega you get is the one your work paid for.

**Where it lives in the code.** `core/economy.ts` (items, balls, shops, the Mart, feats), the version 6 block in `core/fold.ts` (`act6`, marks, runs, `evalFeats`), tests at the end of `core/fold.test.ts`. The Pokedex has a World tab (the Sunnyside scene as a map, the shops as its buildings, cloud over regions not open yet) and its sprites are the ball sheet and item icons supplied, in `public/sprites`.

---

## The game today: rules version 5 (from 8 Oct 2026; its money rules are replaced by version 6 above)

Version 5 begins on the day version 4 was due to, so version 4 never ran a day by itself. Everything in the version 4 section below is still in force; version 5 adds the second half of the loop: **things to do with what the work earned**. The reasoning, and the review it went through, is in `V5-LOOP.md` in the workspace folder; the audit that led to it is `GAME-AUDIT.md`.

| Piece | Earned by | Used for |
|---|---|---|
| XP | every habit | the partner. Cannot be bought |
| Coins | 1 for each XP of the day's work (before momentum), and daily quests | balls to throw, berries |
| Gems | a catch, an evolution, a badge, a league, a graduation, weekly quests, the Professor | incense, scene themes |
| Great / Ultra Ball | the shop | thrown at the wild Pokemon: 80 or 200 HP at once |
| Berry | the shop | a heart for the partner. Hearts (days together plus berries) only go up |
| Incense | the shop | choose the next wild Pokemon from three |
| Team of three | fully trained Pokemon | each one whose type beats the leader's adds 10% to every strike. Left alone, it is your last three trained |
| The Professor | any Pokemon in the Box | 5 gems, and a Box that does not pile up |
| Quests | the day and the week | paid by themselves, no claiming |
| The season | every 1,500 XP of the month's work is a step | each step hands over coins, gems or an item by itself; it starts again each month |
| Chest | the shop, for gems | opened as it is bought: coins, balls, berries or, now and then, incense |
| Rare Egg | the shop, for gems | kept warm by days with two pillars; after five it hatches a rare Pokemon into the Box |

Catch damage is now 100 x (share of the day) to the power 1.5 x the ball, a softer curve than the square. Everything done in the Pokedex is one small `item_use` event in the ledger (`buy`, `throw`, `feed`, `wish`, `team`, `transfer`, `theme`), so the game is still recomputed from the ledger alone and both apps agree.

The Pokedex's tabs are now Home, Team, Shop, Pokedex and Trainer; the rules are behind the "?" in the top bar.

---

## Rules version 4 (all still in force inside version 5)

This section is the rules in force. Everything further down about the game (sections 5 and 15) is history, kept so the reasoning is not lost; where it disagrees with this section, this section is right. Every number below lives in `pokedex/core/rules.ts`.

Version 4 changed what rewards are, not how fast they come. No XP, HP or pace number moved. It came out of two outside reviews (a design audit and a study of how Clash Royale gives each reward one job), checked against the code.

### One day does three things

| What the day was | What it moves | What that earns |
|---|---|---|
| How **much** you did | the partner's XP | levels, evolution on its own, graduation |
| How **whole** it was | the wild Pokemon's HP | a catch, into the Box |
| What **kind** of work | the gym leader's HP | that leader's badge |

- **XP.** Pillar 100, core 30, standard 3, basic 1. All of it goes to one partner. Arbor and Woodshed pay for the share of the block done. Momentum (how many of the last seven days had two or more pillars) multiplies XP by up to 1.5 and never resets.
- **The partner.** Level L needs 6 x L squared XP. Three-stage lines evolve at 16 and 36, two-stage lines at 25, by themselves. At 50 (30 for a single stage) it is fully trained and the next one takes over: the one you chose, else the oldest in the Box, else an egg.
- **The wild Pokemon.** One at a time; it stays until caught and never flees. Each day hits it for 100 x (share of the day's XP done) squared x the ball. The ball comes from the chores (Great at half done, Ultra at four-fifths). A perfect day catches it on the spot and is the only way to a shiny (1 in 10).
- **The league.** Each leader has 4,000 HP. The day's work (before momentum) wears it down; the domains that leader is weak to count x1.5, and a partner whose type beats the leader's adds x1.2. HP carries over. There are no weeks and no losing. A region opens when the league before it is beaten and two more partners are trained.

### What each reward means

| Reward | It stands for | Kept how |
|---|---|---|
| Level, evolution, graduation | the partner you are raising | for good |
| A catch | discovery | in the Box, in the ball of that day |
| A badge | the campaign: every gym leader gives one | for good, in the badge case |
| Hall of Fame | a league won | for good |
| The Key Stone and Mega | a durable achievement | for good |
| A nature | what the partner was raised on | for good |
| Days together | bond | only counts up |

- **Badges are the gym reward.** No stone is handed out any more, by anyone. Stones won under version 3 stay in the Bag as keepsakes and do nothing.
- **Mega is kept for good.** The Key Stone comes with the eighth Kanto badge. From then on, a fully evolved partner that has a Mega form registers it the first time a leader falls to it, or when it finishes training at the latest, so none can be missed. It never runs out. The partner is drawn as its Mega unless you choose the plain form. Mega also still shows for the day on a day with full momentum and every pillar done, as before.
- **A nature at graduation.** The domain the partner did best in over its whole time with you is the stat its nature raises; the one it did least in is the stat it lowers (Attack is the gym, Defense is Arbor, Sp. Atk is code, Sp. Def is guitar, Speed is the chores). The real table of twenty-five. Two Charizards raised in different months are different.
- **Bond is never lost.** The ribbon that two empty days used to take away is gone. A partner counts the days you spent together (days with at least one pillar), and that number only goes up. Dozing off is still drawn; it costs nothing.
- **Nothing costs anything.** Three things can be chosen by hand in the Pokedex, all free and none needed: which way a branching Pokemon evolves, bringing one forward from the Box today, and which form a partner with a Mega shows. Ignore the Pokedex for a month and the game plays the same.

### A day's list can grow but not shrink

Life OS writes the day's habit list to the ledger (`day_list`), with each habit's tier and domain. From version 4 the first list of a day stands. A habit added during the day joins it. Taking a habit off, reordering, or changing a tier or domain starts tomorrow. So a missed habit cannot be edited out of today to make the day perfect. (Under version 3 the last list of the day stood.) A day on which Life OS was never opened has no list and still follows the library.

A habit's **domain** (code, gym, guitar, Arbor, sleep, chore) is now a setting on the habit, next to its tier. The five habits the game already knew keep theirs by id. A pillar left as a chore is flagged on the Pokedex's Trainer tab, because it would hit no leader's weakness and lead no branch.

### Field notes: each domain in its own unit

The Trainer tab counts, for life: coding days; workouts and lifts that beat every earlier session (read from Strong's sets); guitar sessions done in full, items played clean at tempo and song parts owned (read from Woodshed's logs); Arbor mornings done in full; steps, up to 10,000 a day, once the band reports them. Nothing is earned from these yet. They are what the next version's rewards are priced from.

### What comes next (not built)

- **Version 5, after about four weeks of real days:** one retune of pace from the real ledger (`node tools/export-ledger.mjs`, then `node tools/replay.mjs`), and each domain gets its own item, earned in its own unit and never taken back: a TM for coding days, a record medal for lifts, a contest ribbon for song parts owned, a field move for Arbor mornings, and Incense with each badge (the one thing that is spent: pick the next wild Pokemon from three). Thresholds come from the field notes, not from guesses.
- **Steps hatch an egg**, once the band has reported steps for two weeks. One incubator, capped steps, hatches into the Box, never needed for the next partner.
- **Not planned:** money, a shop, a general currency, anything that must be done in the Pokedex, anything that can be lost.

### Versions

| Version | From | What changed |
|---|---|---|
| 1 | 2026-10-03 | first rules: a perfect day catches, weekly badges |
| 3 | 2026-10-05 | the wild Pokemon with HP, the Box, leaders with HP, stones, measured Sleep (version 2 never ran) |
| 4 | (never ran alone) | badges as the reward, no stones, Mega for good, natures, bond never lost, a day's list only grows, domains set on the habit |
| 5 | 2026-10-08 | all of version 4, plus coins, gems, the shop, thrown balls, berries, incense, the team, the Professor, quests, a softer catch curve |

Each day is always replayed under the version it was played under (`rulesOn` in `rules.ts`). `pokedex/core/fixtures/golden.json` is a recorded run of versions 1 and 3; the tests fail if a later change alters what those days were. After any change to the core: `npm test` and `node tools/simulate.mjs` in pokedex, then `npm run core` (the tests also fail if Life OS's copy differs).

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

## 5. History: the game under version 1 (3 and 4 Oct 2026)

Kept for the reasoning. For the rules in force see "The game today" near the top.

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

- A full day is about 470 XP. The four pillars (LeetCode, Gym, Woodshed, and Arbor since 2026-10-05) are 400 of it. The whole routine together is worth less than half a pillar: enough that it is not zero, never enough to level on. Pillar rows carry a yellow column mark in the checklist.
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

1. **Sleep as a measured fifth pillar.** "Sleep At 10" ticked and locked by the band, the way Gym is by Strong.
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
| 3 | 2026-10-05 | see section 15 |
| 4 | 2026-10-08 | see "The game today" |

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

---

## 15. History: version 3 (5 to 7 Oct 2026)

Replaced by version 4 on 8 Oct 2026. What still holds from here: the wild Pokemon, the Box, leaders with HP, the leagues and the measured Sleep pillar. What does not: stones (no longer earned or spent), the seven-day Mega, the Bond ribbon that could be lost, and "the last list of the day stands".

Written 5 Oct 2026. Where this section and an earlier one disagree, this one is current: sections 5, 8, 11 and 13 were written for version 1. Version 2 was designed and replaced before its first day, so the game has only ever run versions 1 and 3. The reasoning behind version 3 is in `V3-GAME-SPEC.md` and `GAME-DESIGN-REVIEW.md` in the workspace folder.

### The idea

Your day's work does three different things. Nothing new to tick, nothing you have to decide.

| Question | What it feeds | Driven by |
|---|---|---|
| How much did I do? | The partner's XP | All XP × momentum (unchanged) |
| How whole was my day? | The wild Pokemon's HP: catching | Share of the day's XP done, squared, × ball |
| What kind of work was it? | The gym leader's HP: the league | XP by domain, × the leader's weakness |

### What did not change

One partner gets all the XP. It levels up and evolves by itself: no item, no condition, nothing to tap. Momentum, the level curve and Gigantamax on a perfect day are as in section 5. Days before 5 Oct keep the version 1 rules.

### Catching: one wild Pokemon at a time

- One wild Pokemon stands in front of you until it is caught. It does not change daily and it never flees.
- Each day hits it for **100 × (share of the day's XP done)² × ball**. A whole day hits four times as hard as a half day.
- The **ball** comes from the chores: Poke Ball ×1, Great Ball ×1.25 at half of them done, Ultra Ball ×1.5 at four-fifths.
- HP by rarity: common 700, uncommon 1,100, rare 1,600. Every 25th to appear is a legendary with 3,000.
- When it is caught, the next one appears the following morning.

**A perfect day** (every habit done) catches it on the spot, whatever HP is left, legendary included. It is the only way to a shiny (1 in 10 on that catch). Every fifth one hands over a stone.

Expected pace, from the simulator on invented behaviour: at about two-thirds of the day done, a catch every two weeks or so, two or three for each partner raised.

### The Box

Caught Pokemon go to a Box, not a queue: nothing in it is waiting for anything. When the partner is fully trained, the oldest in the Box takes over unless you tapped another one in the Pokedex first, which is free. An egg hatches only if the Box is empty. The Pokedex counts three things per region: seen, caught, raised.

### The league: leaders have HP

- The leader in front of you has 4,000 HP. Every day's XP wears it down; the one or two domains that leader is weak to count ×1.5. The weaknesses come from the real type chart (Brock, Rock: Arbor and Gym. Misty, Water: Arbor and Code. Sabrina, Psychic: Sleep and Code).
- If your partner's type is super effective against the leader's, everything counts ×1.2 more.
- HP carries over. There are no weeks, no thresholds and no losing.
- A league is its gyms, then the Elite Four, then the Champion. After Kanto come the **Orange Islands** (Cissy, Danny, Rudy, Luana, then Drake: four badges, no Elite Four, opens no new species), then Johto.
- A region opens only when the league before it is beaten **and** two more partners are fully trained. A league whose region is not open yet waits.
- Beating a Champion writes a **Hall of Fame** entry: the partner, the last five raised, the date and the six stats.

### Stones and Mega

A stone comes from every second gym, each of the Elite Four, each Champion and every fifth perfect day: about ten a region. Nothing needs one. Spend it by hand in the Bag on a 7-day Mega Evolution, on choosing a branch (it still evolves by itself), or on changing partner straight away. None gives XP.

Mega also shows by itself on a day with full momentum **and** every pillar done.

For a partner whose next evolution branches, the card shows the lean ("Flareon 41%, Jolteon 33%"): what your habits are choosing.

### The day's list is frozen

Life OS writes the day's habit list to the ledger (`day_list`) on the day itself, and again if you edit the list that day. A later edit or deletion can no longer change what an earlier day was.

### Sleep, once the band is in use

From the first morning the band reports a sleep score, the sleep habit becomes a pillar only the band can fill. It pays the score as a share of 100 XP and counts as done at 80 or more. It is not judged on the clock. A poor night costs XP but never a perfect day. Until the band exists, the habit is ticked by hand.

### Trainer stats

Six numbers on the Trainer card, each the share of that thing done over the last 28 days: HP sleep, Attack gym, Defense recovery (Arbor stands in until the band reports recovery), Sp. Atk code, Sp. Def guitar, Speed steps against 10,000. Yours, not the partner's; nothing is paid on them.

### Vitals and Strong

- **Vitals is a viewer.** The band talks to Google Health; Vitals' own server reads it once a day and writes `vitals` rows (with `sleepScore` and `recovery` worked out) to the ledger. Setup is in `vitals/README.md`. The band is not connected yet.
- **Strong** logs workouts and keeps the body heatmap. Its charts and records are in the Training section of Vitals.

### Changing a number

Every number is in `pokedex/core/rules.ts`. After changing one: `node tools/simulate.mjs` in `pokedex/` to see what a year looks like, `npm test`, `npm run core` to copy the core into Life OS, then deploy both. Give the change a start date so earlier days keep their rules.

### Still weak

- **Every number was picked on invented behaviour.** Expect one retune from the real ledger after three or four weeks.
- **The ledger still has no login** (section 13, item 1).
- **The band sync has never met a real Google account.**
- **No pictures exist of the Orange Crew**, so they show as a question mark. Alola, Galar and Paldea have no badge art.
- Left for later on purpose: domain rewards beyond the ball (friendship, moves, eggs on steps), legendary trials, trainer rank, a night encounter.
