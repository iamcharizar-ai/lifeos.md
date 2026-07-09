// Health tab — the body console. Samsung-Health-style tile dashboard over the
// forge-terminal skin, with MacroFactor-style logging underneath: every meal,
// glass, and pill enters here. Food/water/meds ride DayHealth (generic health
// events → cloud + vault untouched); kcal/protein metrics auto-derive from the
// food log so the Metrics bonus and vault write-back keep working unchanged.
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FOODS,
  GLASS_ML,
  KCAL_TARGET,
  MEAL_META,
  MEALS,
  PROTEIN_TARGET,
  WATER_TARGET_ML,
  searchFoods,
  type FoodItem,
  type Meal,
} from '../config/foods'
import { sleepXp, stepsXp, waterXp, STEPS_XP_CAP, SLEEP_XP } from '../lib/xp'
import {
  foodTotals,
  healthEarned,
  parseFoods,
  parseMeds,
  sleepHours,
  type DayHealth,
  type DayMetrics,
  type FoodLogEntry,
} from '../lib/ledger'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { BarcodeScanner } from '../components/BarcodeScanner'

const MEDS = ['Creatine', 'Multivitamin', 'Eye drops', 'Omega-3']

// ── shared ring (Samsung Health tile dial) ──────────────────────────
function Ring({ pct, size = 64, children }: { pct: number; size?: number; children?: React.ReactNode }) {
  const full = pct >= 1
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r="32" fill="none" stroke="#232d3d" strokeWidth="6" />
        <motion.circle
          cx="38"
          cy="38"
          r="32"
          fill="none"
          stroke={full ? '#f0b429' : '#ff5c38'}
          strokeWidth="6"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.min(pct, 1) }}
          transition={{ type: 'spring', stiffness: 55, damping: 15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="plate p-4">
      <div className="hud-label mb-2">{label}</div>
      {children}
    </div>
  )
}

// ── add-food state machine: closed → search → portion(item) → custom ─
type AddState =
  | { mode: 'closed' }
  | { mode: 'search'; meal: Meal }
  | { mode: 'portion'; meal: Meal; item: FoodItem }
  | {
      mode: 'custom'
      meal: Meal
      name: string
      /** per-100 g bases, prefilled by a barcode hit */
      kcal: string
      protein: string
      carbs: string
      fat: string
    }

export function HealthScreen({
  health,
  onChange,
  metrics,
  onMetric,
}: {
  health: DayHealth | undefined
  onChange: (key: keyof DayHealth, value: string) => void
  metrics: DayMetrics | undefined
  onMetric: (key: keyof DayMetrics, value: string) => void
}) {
  const foods = useMemo(() => parseFoods(health), [health])
  const meds = useMemo(() => parseMeds(health), [health])
  const totals = foodTotals(foods)
  const earned = healthEarned(health)
  const steps = parseFloat(health?.steps ?? '0') || 0
  const water = parseFloat(health?.water ?? '0') || 0
  const hours = sleepHours(health?.bed, health?.wake) || (parseFloat(health?.sleep ?? '0') || 0)

  const [add, setAdd] = useState<AddState>({ mode: 'closed' })
  const [scanning, setScanning] = useState<Meal | null>(null)
  const [scanBusy, setScanBusy] = useState(false)

  // Foods are the source of truth — kcal/protein metrics derive on every write
  // so the Metrics bonus and the vault's kcal::/protein:: fields stay live.
  const writeFoods = (next: FoodLogEntry[]) => {
    onChange('foods', JSON.stringify(next))
    const t = foodTotals(next)
    onMetric('kcal', String(Math.round(t.kcal)))
    onMetric('protein', String(Math.round(t.protein)))
  }

  const logFood = (meal: Meal, name: string, grams: number, base: { kcal: number; protein: number; carbs: number; fat: number }) => {
    const k = grams / 100
    writeFoods([
      ...foods,
      {
        id: crypto.randomUUID(),
        name,
        grams,
        kcal: Math.round(base.kcal * k),
        protein: Math.round(base.protein * k * 10) / 10,
        carbs: Math.round(base.carbs * k * 10) / 10,
        fat: Math.round(base.fat * k * 10) / 10,
        meal,
        at: new Date().toISOString(),
      },
    ])
    setAdd({ mode: 'closed' })
  }

  const removeFood = (id: string) => writeFoods(foods.filter((f) => f.id !== id))

  const addWater = (delta: number) => {
    const next = Math.max(0, water + delta)
    onChange('water', String(next))
    if (delta > 0) onChange('waterAt', new Date().toISOString())
  }

  const toggleMed = (name: string) => {
    const next = meds.includes(name) ? meds.filter((m) => m !== name) : [...meds, name]
    onChange('meds', JSON.stringify(next))
  }

  const setSleepTimes = (key: 'bed' | 'wake', value: string) => {
    onChange(key, value)
    const b = key === 'bed' ? value : health?.bed
    const w = key === 'wake' ? value : health?.wake
    const h = sleepHours(b, w)
    if (h > 0) onChange('sleep', String(h))
  }

  // Barcode → Open Food Facts → prefilled custom entry
  const onBarcode = async (code: string) => {
    const meal = scanning ?? 'snack'
    setScanBusy(true)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`)
      const data = (await res.json()) as {
        status: number
        product?: {
          product_name?: string
          nutriments?: Record<string, number>
        }
      }
      const n = data.product?.nutriments
      setAdd({
        mode: 'custom',
        meal,
        name: data.status === 1 ? (data.product?.product_name ?? `#${code}`) : `#${code}`,
        kcal: n?.['energy-kcal_100g'] != null ? String(Math.round(n['energy-kcal_100g'])) : '',
        protein: n?.proteins_100g != null ? String(n.proteins_100g) : '',
        carbs: n?.carbohydrates_100g != null ? String(n.carbohydrates_100g) : '',
        fat: n?.fat_100g != null ? String(n.fat_100g) : '',
      })
    } catch {
      setAdd({ mode: 'custom', meal, name: `#${code}`, kcal: '', protein: '', carbs: '', fat: '' })
    } finally {
      setScanBusy(false)
      setScanning(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── hero: XP + the three meters that pay ── */}
      <div className="plate plate-raised p-5">
        <div className="hud-label text-center">Health XP today</div>
        <div className="mt-3 flex items-center justify-around">
          <Ring pct={steps / (STEPS_XP_CAP * 1000)} size={72}>
            <span className="num text-sm font-bold text-bone">
              {steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps}
            </span>
            <span className="num text-[9px] text-dim">steps</span>
          </Ring>
          <div className="text-center">
            <div className="num font-display text-4xl font-bold text-sage">
              +<AnimatedNumber value={earned} />
            </div>
            <div className="num mt-1 text-[10px] text-ash">
              {stepsXp(steps)} steps · {sleepXp(hours)} sleep · {waterXp(water, WATER_TARGET_ML)} water
            </div>
          </div>
          <Ring pct={water / WATER_TARGET_ML} size={72}>
            <span className="num text-sm font-bold text-bone">{(water / 1000).toFixed(1)}L</span>
            <span className="num text-[9px] text-dim">water</span>
          </Ring>
        </div>
      </div>

      {/* ── tile grid ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Food */}
        <Tile label="🍽️ Food">
          <div className="num text-2xl font-bold text-bone">
            {Math.round(totals.kcal)}
            <span className="ml-1 text-xs font-medium text-dim">/ {KCAL_TARGET} kcal</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {(
              [
                ['P', totals.protein, PROTEIN_TARGET, '#7bd88a'],
                ['C', totals.carbs, 250, '#5b8def'],
                ['F', totals.fat, 70, '#f0b429'],
              ] as const
            ).map(([tag, val, target, color]) => (
              <div key={tag} className="flex items-center gap-2">
                <span className="num w-3 text-[9px] text-dim">{tag}</span>
                <div className="h-1 flex-1 bg-plate2">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${Math.min((val / target) * 100, 100)}%`, background: color }}
                  />
                </div>
                <span className="num w-10 text-right text-[9px] text-ash">{Math.round(val)}g</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* Water */}
        <Tile label="💧 Water">
          <div className="num text-2xl font-bold text-bone">
            {water}
            <span className="ml-1 text-xs font-medium text-dim">/ {WATER_TARGET_ML} ml</span>
          </div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: Math.ceil(WATER_TARGET_ML / GLASS_ML) }, (_, i) => (
              <div
                key={i}
                className={`h-4 flex-1 transition-colors ${
                  water >= (i + 1) * GLASS_ML ? 'bg-haze' : 'bg-plate2'
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => addWater(GLASS_ML)}
              className="chip flex-1 bg-haze/20 py-1.5 text-center text-[11px] font-semibold text-haze"
            >
              + glass ({GLASS_ML})
            </motion.button>
            <button
              onClick={() => addWater(-GLASS_ML)}
              className="chip bg-plate2 px-2.5 py-1.5 text-[11px] text-dim hover:text-ash"
            >
              −
            </button>
          </div>
        </Tile>

        {/* Sleep */}
        <Tile label="😴 Sleep">
          <div className="num text-2xl font-bold text-bone">
            {hours ? `${hours}h` : '—'}
            <span className="ml-1 text-xs font-medium text-dim">of 7h+</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['bed', '🌙 bed', health?.bed],
                ['wake', '☀️ wake', health?.wake],
              ] as const
            ).map(([key, label, value]) => (
              <label key={key} className="flex flex-col gap-0.5">
                <span className="hud-label !text-[8px]">{label}</span>
                <input
                  type="time"
                  value={value ?? ''}
                  onChange={(e) => setSleepTimes(key, e.target.value)}
                  className="num w-full border border-line bg-plate2 px-1.5 py-1 text-xs text-bone outline-none focus:border-line2"
                />
              </label>
            ))}
          </div>
          <div className="num mt-1.5 text-[9px] text-dim">≥7h = +{SLEEP_XP} XP</div>
        </Tile>

        {/* Steps */}
        <Tile label="👟 Steps">
          <input
            type="number"
            inputMode="numeric"
            value={health?.steps ?? ''}
            onChange={(e) => onChange('steps', e.target.value)}
            placeholder="—"
            className="num w-full bg-transparent text-2xl font-bold text-bone outline-none placeholder:text-dim"
          />
          <div className="num mt-1.5 text-[9px] text-dim">1 XP / 1k · cap {STEPS_XP_CAP}</div>
        </Tile>

        {/* Weight */}
        <Tile label="⚖️ Weight">
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={metrics?.weight ?? ''}
              onChange={(e) => onMetric('weight', e.target.value)}
              placeholder="—"
              className="num w-full bg-transparent text-2xl font-bold text-bone outline-none placeholder:text-dim"
            />
            <span className="text-xs text-dim">kg</span>
          </div>
          <div className="num mt-1.5 text-[9px] text-dim">daily weigh-in</div>
        </Tile>

        {/* Heart rate */}
        <Tile label="🫀 Resting HR">
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="numeric"
              value={health?.hr ?? ''}
              onChange={(e) => onChange('hr', e.target.value)}
              placeholder="—"
              className="num w-full bg-transparent text-2xl font-bold text-bone outline-none placeholder:text-dim"
            />
            <span className="text-xs text-dim">bpm</span>
          </div>
          <div className="num mt-1.5 text-[9px] text-dim">tracked, no XP</div>
        </Tile>
      </div>

      {/* ── food log (MacroFactor) ── */}
      <div className="plate p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="hud-label !text-sage">Food log</h2>
          <span className="num text-[10px] text-dim">
            {Math.round(totals.kcal)} kcal · {Math.round(totals.protein)}g protein
          </span>
        </div>

        <div className="space-y-3">
          {MEALS.map((meal) => {
            const entries = foods.filter((f) => f.meal === meal)
            const mealKcal = entries.reduce((s, f) => s + f.kcal, 0)
            return (
              <div key={meal}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-bone">
                    {MEAL_META[meal].emoji} {MEAL_META[meal].label}
                  </span>
                  <div className="flex items-center gap-2">
                    {mealKcal > 0 && <span className="num text-[10px] text-ash">{mealKcal} kcal</span>}
                    <button
                      onClick={() => setScanning(meal)}
                      title="scan barcode"
                      className="chip bg-plate2 px-2 py-0.5 text-[11px] text-ash hover:text-bone"
                    >
                      ▥
                    </button>
                    <button
                      onClick={() => setAdd({ mode: 'search', meal })}
                      className="chip bg-plate2 px-2 py-0.5 text-[11px] text-ash hover:text-bone"
                    >
                      + add
                    </button>
                  </div>
                </div>
                {entries.length > 0 && (
                  <div className="space-y-1">
                    {entries.map((f) => (
                      <div
                        key={f.id}
                        className="chip flex items-center gap-2 border border-line bg-plate2 px-2.5 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs text-bone">{f.name}</span>
                        <span className="num shrink-0 text-[10px] text-dim">{f.grams}g</span>
                        <span className="num shrink-0 text-[10px] text-ash">{f.kcal} kcal</span>
                        <span className="num shrink-0 text-[10px] text-sage">{f.protein}P</span>
                        <button
                          onClick={() => removeFood(f.id)}
                          className="shrink-0 text-[10px] text-dim hover:text-ember"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {scanBusy && (
          <div className="mt-3 text-center text-[10px] text-dim">looking up product…</div>
        )}
      </div>

      {/* ── meds ── */}
      <div className="plate p-4">
        <h2 className="hud-label mb-2">💊 Meds & supps</h2>
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...MEDS, ...meds])].map((m) => {
            const taken = meds.includes(m)
            return (
              <button
                key={m}
                onClick={() => toggleMed(m)}
                className={`chip border px-3 py-1.5 text-xs transition-colors ${
                  taken
                    ? 'border-gold-dim bg-gold/10 text-gold'
                    : 'border-line bg-plate2 text-ash hover:border-line2'
                }`}
              >
                {taken ? '✓ ' : ''}
                {m}
              </button>
            )
          })}
          <MedAdder onAdd={toggleMed} />
        </div>
      </div>

      {/* ── modals ── */}
      {scanning && (
        <BarcodeScanner
          onDetect={(code) => {
            void onBarcode(code)
          }}
          onClose={() => setScanning(null)}
        />
      )}
      {add.mode === 'search' && (
        <FoodSearch
          onPick={(item) => setAdd({ mode: 'portion', meal: add.meal, item })}
          onCustom={() =>
            setAdd({ mode: 'custom', meal: add.meal, name: '', kcal: '', protein: '', carbs: '', fat: '' })
          }
          onClose={() => setAdd({ mode: 'closed' })}
        />
      )}
      {add.mode === 'portion' && (
        <PortionPicker
          item={add.item}
          onLog={(grams) => logFood(add.meal, add.item.name, grams, add.item)}
          onClose={() => setAdd({ mode: 'closed' })}
        />
      )}
      {add.mode === 'custom' && (
        <CustomFood
          initial={add}
          onLog={(name, grams, base) => logFood(add.meal, name, grams, base)}
          onClose={() => setAdd({ mode: 'closed' })}
        />
      )}
    </div>
  )
}

// ── food vault search sheet ─────────────────────────────────────────
function FoodSearch({
  onPick,
  onCustom,
  onClose,
}: {
  onPick: (item: FoodItem) => void
  onCustom: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const list = searchFoods(q)
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/80 p-4" onClick={onClose}>
      <div
        className="plate flex max-h-[75vh] w-full max-w-md flex-col p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="hud-label">Food vault · {FOODS.length} items</span>
          <button onClick={onClose} className="text-xs text-dim hover:text-ash">
            close
          </button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search foods…"
          className="mb-2 w-full border border-line bg-plate2 px-3 py-2 text-sm text-bone outline-none focus:border-line2"
        />
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {list.map((f) => (
            <button
              key={f.id}
              onClick={() => onPick(f)}
              className="chip flex w-full items-center gap-2 bg-plate2 px-3 py-2 text-left hover:bg-line/40"
            >
              <span className="text-base">{f.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-bone">{f.name}</span>
              <span className="num shrink-0 text-[10px] text-dim">
                {Math.round((f.kcal * f.serving) / 100)} kcal · {f.servingLabel}
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <div className="py-4 text-center text-xs text-dim">nothing in the vault for that</div>
          )}
        </div>
        <button
          onClick={onCustom}
          className="chip mt-2 w-full border border-dashed border-line py-2 text-xs text-dim hover:text-ash"
        >
          + custom entry (own macros)
        </button>
      </div>
    </div>
  )
}

// ── portion sheet: servings stepper + free grams ────────────────────
function PortionPicker({
  item,
  onLog,
  onClose,
}: {
  item: FoodItem
  onLog: (grams: number) => void
  onClose: () => void
}) {
  const [grams, setGrams] = useState(item.serving)
  const k = grams / 100
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/80 p-4" onClick={onClose}>
      <div className="plate w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-bone">
            {item.emoji} {item.name}
          </span>
          <button onClick={onClose} className="text-xs text-dim hover:text-ash">
            close
          </button>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setGrams((g) => Math.max(item.serving, g - item.serving))}
            className="chip bg-plate2 px-4 py-2 text-lg text-ash"
          >
            −
          </button>
          <div className="text-center">
            <div className="num text-2xl font-bold text-bone">{grams}g</div>
            <div className="num text-[10px] text-dim">
              {(grams / item.serving).toFixed(1)} × {item.servingLabel}
            </div>
          </div>
          <button
            onClick={() => setGrams((g) => g + item.serving)}
            className="chip bg-plate2 px-4 py-2 text-lg text-ash"
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={10}
          max={Math.max(500, item.serving * 5)}
          step={5}
          value={grams}
          onChange={(e) => setGrams(Number(e.target.value))}
          className="mt-3 w-full accent-[#f0b429]"
        />
        <div className="num mt-3 flex justify-around text-center text-[11px] text-ash">
          <span>🔥 {Math.round(item.kcal * k)} kcal</span>
          <span className="text-sage">P {Math.round(item.protein * k * 10) / 10}g</span>
          <span className="text-haze">C {Math.round(item.carbs * k * 10) / 10}g</span>
          <span className="text-gold">F {Math.round(item.fat * k * 10) / 10}g</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onLog(grams)}
          className="chip mt-4 w-full bg-gold py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.15em] text-ink"
        >
          Log it
        </motion.button>
      </div>
    </div>
  )
}

// ── custom / barcode-prefilled entry ────────────────────────────────
function CustomFood({
  initial,
  onLog,
  onClose,
}: {
  initial: { name: string; kcal: string; protein: string; carbs: string; fat: string }
  onLog: (name: string, grams: number, base: { kcal: number; protein: number; carbs: number; fat: number }) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [grams, setGrams] = useState('100')
  const [kcal, setKcal] = useState(initial.kcal)
  const [protein, setProtein] = useState(initial.protein)
  const [carbs, setCarbs] = useState(initial.carbs)
  const [fat, setFat] = useState(initial.fat)
  const valid = name.trim() && (parseFloat(kcal) || 0) >= 0 && (parseFloat(grams) || 0) > 0
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/80 p-4" onClick={onClose}>
      <div className="plate w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="hud-label">Custom food · per 100 g</span>
          <button onClick={onClose} className="text-xs text-dim hover:text-ash">
            close
          </button>
        </div>
        <input
          autoFocus={!initial.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name…"
          className="mb-2 w-full border border-line bg-plate2 px-3 py-2 text-sm text-bone outline-none focus:border-line2"
        />
        <div className="grid grid-cols-5 gap-2">
          {(
            [
              ['kcal', kcal, setKcal],
              ['P g', protein, setProtein],
              ['C g', carbs, setCarbs],
              ['F g', fat, setFat],
              ['ate g', grams, setGrams],
            ] as const
          ).map(([label, value, set]) => (
            <label key={label} className="flex flex-col gap-0.5">
              <span className="hud-label !text-[8px]">{label}</span>
              <input
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder="0"
                className="num w-full border border-line bg-plate2 px-1.5 py-1.5 text-center text-xs text-bone outline-none focus:border-line2"
              />
            </label>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          disabled={!valid}
          onClick={() =>
            onLog(name.trim(), parseFloat(grams) || 100, {
              kcal: parseFloat(kcal) || 0,
              protein: parseFloat(protein) || 0,
              carbs: parseFloat(carbs) || 0,
              fat: parseFloat(fat) || 0,
            })
          }
          className={`chip mt-3 w-full py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.15em] ${
            valid ? 'bg-gold text-ink' : 'bg-plate2 text-dim'
          }`}
        >
          Log it
        </motion.button>
      </div>
    </div>
  )
}

function MedAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="chip border border-dashed border-line px-3 py-1.5 text-xs text-dim hover:text-ash"
      >
        + other
      </button>
    )
  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onAdd(name.trim())
        setName('')
        setOpen(false)
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setOpen(false)}
        placeholder="med name…"
        className="w-28 border border-line bg-plate2 px-2 py-1 text-xs text-bone outline-none focus:border-line2"
      />
      <button type="submit" className="chip bg-gold/20 px-2 py-1 text-xs text-gold">
        ✓
      </button>
    </form>
  )
}
