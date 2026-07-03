import { motion } from 'framer-motion'
import { WORKOUT_TYPES } from '../config/skills'
import { WORKOUT_XP } from '../lib/xp'
import type { DayWorkout } from '../lib/ledger'

export function TrainScreen({
  workout,
  onLogWorkout,
  onClearWorkout,
}: {
  workout: DayWorkout | undefined
  onLogWorkout: (type: string) => void
  onClearWorkout: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="plate p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="hud-label">Today's workout</div>
          <span className="num text-[10px] text-gold">+{WORKOUT_XP} XP</span>
        </div>
        {workout ? (
          <div className="chip flex items-center justify-between border border-gold-dim bg-gold/10 px-4 py-3">
            <span className="text-sm font-semibold text-bone">
              🏋️ {workout.type} logged <span className="num text-gold">+{WORKOUT_XP} XP</span>
            </span>
            <button onClick={onClearWorkout} className="text-xs text-ash hover:text-bone">
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
                className="chip border border-line bg-plate2 px-3 py-2.5 text-sm font-medium text-ash transition-colors hover:border-ember-dim hover:text-bone"
              >
                {t}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <div className="chip border border-dashed border-line p-4 text-center text-xs text-dim">
        Workout builder lives here next — routines, sets &amp; logs. Design pending. 🏗️
      </div>
    </div>
  )
}
