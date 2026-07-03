import { motion } from 'framer-motion'
import {
  BRANCH_META,
  SKILLS,
  skillStatus,
  WORKOUT_TYPES,
  type Branch,
  type SkillState,
  type SkillStatus,
} from '../config/skills'
import { WORKOUT_XP } from '../lib/xp'
import type { DayWorkout } from '../lib/ledger'

const STATUS_STYLE: Record<SkillStatus, string> = {
  unlocked: 'border-emerald-400/50 bg-emerald-400/10 text-zinc-100',
  training: 'border-amber-400/50 bg-amber-400/10 text-zinc-100',
  locked: 'border-zinc-800 bg-zinc-900/40 text-zinc-500',
}

const STATUS_BADGE: Record<SkillStatus, string> = {
  unlocked: '✅',
  training: '⚡',
  locked: '🔒',
}

const NEXT_STATUS: Record<SkillStatus, SkillStatus> = {
  locked: 'training',
  training: 'unlocked',
  unlocked: 'locked',
}

export function BodyScreen({
  workout,
  onLogWorkout,
  onClearWorkout,
  skills,
  onSkill,
}: {
  workout: DayWorkout | undefined
  onLogWorkout: (type: string) => void
  onClearWorkout: () => void
  skills: SkillState
  onSkill: (id: string, status: SkillStatus) => void
}) {
  const unlockedCount = SKILLS.filter((s) => skillStatus(skills, s) === 'unlocked').length

  return (
    <div className="space-y-5">
      {/* Workout log */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Today's workout
          </div>
          <span className="text-[10px] text-zinc-600">+{WORKOUT_XP} XP</span>
        </div>
        {workout ? (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3">
            <span className="text-sm font-semibold">
              🏋️ {workout.type} logged <span className="text-emerald-300">+{WORKOUT_XP} XP</span>
            </span>
            <button onClick={onClearWorkout} className="text-xs text-zinc-500 hover:text-zinc-300">
              undo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {WORKOUT_TYPES.map((t) => (
              <motion.button
                key={t}
                whileTap={{ scale: 0.93 }}
                onClick={() => onLogWorkout(t)}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-cyan-400/50"
              >
                {t}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Skill tree */}
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-violet-300">
          Calisthenics skill tree
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-500">
          {unlockedCount}/{SKILLS.length} unlocked
        </span>
      </div>

      {(Object.keys(BRANCH_META) as Branch[]).map((branch) => {
        const meta = BRANCH_META[branch]
        const list = SKILLS.filter((s) => s.branch === branch)
        return (
          <section key={branch} className="relative pl-4">
            <div className="absolute bottom-2 left-0 top-1 w-px bg-gradient-to-b from-violet-400/50 to-transparent" />
            <div className="mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                {meta.label}
              </span>
              <span className="ml-2 text-[10px] text-zinc-600">{meta.hint}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {list.map((s, i) => {
                const st = skillStatus(skills, s)
                return (
                  <motion.button
                    key={s.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => onSkill(s.id, NEXT_STATUS[st])}
                    className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${STATUS_STYLE[st]}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {s.emoji} <span className="font-medium">{s.name}</span>
                      </span>
                      <motion.span
                        animate={st === 'training' ? { opacity: [1, 0.4, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.6 }}
                        className="text-xs"
                      >
                        {STATUS_BADGE[st]}
                      </motion.span>
                    </div>
                    {s.note && <div className="mt-0.5 text-[10px] text-zinc-600">{s.note}</div>}
                  </motion.button>
                )
              })}
            </div>
          </section>
        )
      })}

      <div className="rounded-2xl border border-dashed border-zinc-800 p-3 text-center text-[10px] text-zinc-600">
        tap a skill to cycle 🔒 locked → ⚡ training → ✅ unlocked · tree definition lives in the
        vault (calisthenics-goals)
      </div>
    </div>
  )
}
