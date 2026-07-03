import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  nodeState,
  PATH_META,
  routeTo,
  SKILL_MAP,
  SKILLS,
  skillStatus,
  type NodeState,
  type PathId,
  type Skill,
  type SkillState,
  type SkillStatus,
} from '../config/skills'

// Logical coordinate space: 3 columns × 84px rows, x stretched to fit.
const VW = 300
const ROW_H = 84
const NODE_H = 60
const colX = (c: number) => VW / 6 + (c * VW) / 3 // column centers: 50, 150, 250

function edgePath(from: Skill, to: Skill): string {
  const x1 = colX(from.pos[1])
  const y1 = from.pos[0] * ROW_H + NODE_H // bottom of parent
  const x2 = colX(to.pos[1])
  const y2 = to.pos[0] * ROW_H // top of child
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

const STATE_CHIP: Record<NodeState, { label: string; cls: string }> = {
  unlocked: { label: 'Unlocked', cls: 'text-gold border-gold-dim bg-gold/10' },
  training: { label: 'Training', cls: 'text-ember border-ember-dim bg-ember/10' },
  available: { label: 'Available', cls: 'text-bone border-line2 bg-plate2' },
  locked: { label: 'Locked', cls: 'text-dim border-line bg-plate' },
}

function TreeNode({
  skill,
  state,
  onSelect,
  selected,
}: {
  skill: Skill
  state: NodeState
  onSelect: (s: Skill) => void
  selected: boolean
}) {
  const base =
    'chip absolute flex flex-col items-center justify-center gap-0.5 border px-1 py-1.5 text-center transition-colors'
  const look =
    state === 'unlocked'
      ? 'border-gold-dim bg-gold/10 text-bone'
      : state === 'training'
        ? 'border-ember-dim bg-ember/10 text-bone pulse-ember'
        : state === 'available'
          ? 'border-line2 bg-plate2 text-ash pulse-available'
          : 'border-line bg-plate text-dim opacity-55'
  return (
    <motion.button
      onClick={() => onSelect(skill)}
      whileTap={{ scale: 0.93 }}
      animate={state === 'unlocked' ? { scale: [1, 1.06, 1] } : {}}
      transition={{ duration: 0.4 }}
      className={`${base} ${look} ${selected ? 'z-10 outline outline-1 outline-bone' : ''}`}
      style={{
        left: `calc(${skill.pos[1] * 33.333}% + 5px)`,
        width: 'calc(33.333% - 10px)',
        top: skill.pos[0] * ROW_H,
        height: NODE_H,
      }}
    >
      <span className="text-base leading-none">
        {state === 'locked' ? '🔒' : skill.emoji}
        {skill.star && state !== 'locked' && <span className="ml-0.5 text-[9px]">⭐</span>}
      </span>
      <span className="line-clamp-2 text-[9px] font-semibold leading-tight">{skill.name}</span>
    </motion.button>
  )
}

function DetailSheet({
  skill,
  skills,
  onSkill,
  onClose,
}: {
  skill: Skill
  skills: SkillState
  onSkill: (id: string, status: SkillStatus) => void
  onClose: () => void
}) {
  const [confirmOverride, setConfirmOverride] = useState(false)
  const st = nodeState(skills, skill)
  const meta = PATH_META[skill.path]
  const blockers = st === 'locked' ? routeTo(skills, skill) : []
  const chip = STATE_CHIP[st]

  const act = (status: SkillStatus) => {
    onSkill(skill.id, status)
    setConfirmOverride(false)
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="plate plate-raised fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-5 pb-8 sm:max-w-2xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="hud-label" style={{ color: meta.hue }}>
            {meta.label}
          </div>
          <div className="mt-1 font-display text-lg font-bold text-bone">
            {skill.emoji} {skill.name} {skill.star && '⭐'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip border px-2 py-0.5 text-[10px] font-semibold ${chip.cls}`}>
            {chip.label}
          </span>
          <button onClick={onClose} className="px-1 text-ash hover:text-bone" aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      {skill.goal && <div className="mt-2 text-xs text-ash">{skill.goal}</div>}

      {skill.tiers && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(['Unlock', 'Progress', 'Mastery'] as const).map((t, i) => (
            <div key={t} className="chip border border-line bg-plate px-2 py-1.5 text-center">
              <div className="hud-label !text-[8px]">{t}</div>
              <div className="num mt-0.5 text-sm font-semibold text-bone">{skill.tiers![i]}</div>
            </div>
          ))}
        </div>
      )}

      {blockers.length > 0 && (
        <div className="mt-3 text-xs text-ash">
          <span className="hud-label !text-[9px]">Route</span>{' '}
          {blockers.map((b, i) => (
            <span key={b.id}>
              {i > 0 && ' · '}
              {b.emoji} {b.name}
            </span>
          ))}{' '}
          <span className="text-dim">first</span>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {st === 'available' && (
          <button
            onClick={() => act('training')}
            className="chip flex-1 border border-ember-dim bg-ember/15 py-2.5 text-sm font-semibold text-ember"
          >
            🔥 Start training
          </button>
        )}
        {st === 'training' && (
          <>
            <button
              onClick={() => act('unlocked')}
              className="chip flex-1 border border-gold-dim bg-gold/15 py-2.5 text-sm font-semibold text-gold"
            >
              ⚡ Mark unlocked
            </button>
            <button
              onClick={() => act('locked')}
              className="chip border border-line bg-plate px-3 py-2.5 text-xs text-ash"
            >
              pause
            </button>
          </>
        )}
        {st === 'unlocked' && (
          <button
            onClick={() => act('locked')}
            className="chip flex-1 border border-line bg-plate py-2.5 text-xs text-ash"
          >
            re-lock (undo)
          </button>
        )}
        {st === 'locked' && (
          <button
            onClick={() => (confirmOverride ? act('unlocked') : setConfirmOverride(true))}
            className={`chip flex-1 border py-2.5 text-sm font-semibold ${
              confirmOverride
                ? 'border-gold-dim bg-gold/15 text-gold'
                : 'border-line2 bg-plate2 text-ash'
            }`}
          >
            {confirmOverride ? 'Confirm — it happened. Unlock.' : 'Did it IRL — unlock anyway'}
          </button>
        )}
      </div>
      <div className="mt-2 text-center text-[9px] text-dim">
        gates are informational — reality always wins
      </div>
    </motion.div>
  )
}

export function SkillTree({
  skills,
  onSkill,
}: {
  skills: SkillState
  onSkill: (id: string, status: SkillStatus) => void
}) {
  const [selected, setSelected] = useState<Skill | null>(null)

  const byPath = useMemo(() => {
    const m = new Map<PathId, Skill[]>()
    for (const s of SKILLS) {
      const list = m.get(s.path) ?? []
      list.push(s)
      m.set(s.path, list)
    }
    return m
  }, [])

  const totalUnlocked = SKILLS.filter((s) => skillStatus(skills, s) === 'unlocked').length

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.22em] text-bone">
          Skill constellation
        </h2>
        <span className="num text-[11px] text-ash">
          <span className="text-gold">{totalUnlocked}</span>/{SKILLS.length} unlocked
        </span>
      </div>

      {(Object.keys(PATH_META) as PathId[]).map((pathId) => {
        const meta = PATH_META[pathId]
        const list = byPath.get(pathId) ?? []
        const rows = Math.max(...list.map((s) => s.pos[0])) + 1
        const height = (rows - 1) * ROW_H + NODE_H
        const unlocked = list.filter((s) => skillStatus(skills, s) === 'unlocked').length
        const edges = list.flatMap((s) =>
          s.requires
            .map((r) => SKILL_MAP.get(r))
            .filter((p): p is Skill => Boolean(p && p.path === pathId))
            .map((p) => ({ from: p, to: s })),
        )
        return (
          <section key={pathId} className="plate p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2" style={{ background: meta.hue }} />
                <span className="hud-label !text-bone">{meta.label}</span>
                <span className="text-[9px] text-dim">{meta.hint}</span>
              </div>
              <span className="num text-[10px] text-ash">
                {unlocked}/{list.length}
              </span>
            </div>

            <div className="relative" style={{ height }}>
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${VW} ${height}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {edges.map(({ from, to }) => {
                  const lit = skillStatus(skills, from) === 'unlocked'
                  return (
                    <path
                      key={`${from.id}-${to.id}`}
                      d={edgePath(from, to)}
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                      stroke={lit ? meta.hue : '#232d3d'}
                      strokeWidth={lit ? 1.5 : 1}
                      strokeOpacity={lit ? 0.75 : 0.9}
                      strokeDasharray={lit ? undefined : '3 4'}
                      style={lit ? { filter: `drop-shadow(0 0 3px ${meta.hue})` } : undefined}
                    />
                  )
                })}
              </svg>
              {list.map((s) => (
                <TreeNode
                  key={s.id}
                  skill={s}
                  state={nodeState(skills, s)}
                  onSelect={setSelected}
                  selected={selected?.id === s.id}
                />
              ))}
            </div>
          </section>
        )
      })}

      <AnimatePresence>
        {selected && (
          <>
            <motion.button
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-20 bg-ink/70"
              aria-label="Close details"
            />
            <DetailSheet
              key={selected.id}
              skill={selected}
              skills={skills}
              onSkill={onSkill}
              onClose={() => setSelected(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
