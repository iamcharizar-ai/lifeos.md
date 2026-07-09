// Muscle Intel — the aesthetics dossier, opened from the Train tab. Every
// muscle ranked by aesthetic ROI (★), with realistic growth timelines and its
// best exercises. Read-only view over MUSCLE_INTEL; the split plans in
// exercises.ts are ordered from the same data.
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  EXERCISE_MAP,
  MUSCLE_INTEL,
  MUSCLE_LABEL,
  type MuscleId,
} from '../config/exercises'

const MUSCLES_BY_ROI = (Object.keys(MUSCLE_INTEL) as MuscleId[]).sort(
  (a, b) => MUSCLE_INTEL[b].roi - MUSCLE_INTEL[a].roi,
)

function Stars({ n, dim = false }: { n: number; dim?: boolean }) {
  return (
    <span className={`num text-[10px] tracking-tight ${dim ? 'text-ash' : 'text-gold'}`}>
      {'★'.repeat(n)}
      <span className="text-line2">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export function MuscleGuide({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<MuscleId | null>(MUSCLES_BY_ROI[0])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/85 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="plate flex max-h-[85vh] w-full max-w-md flex-col p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="hud-label">🧠 Muscle Intel</span>
          <button onClick={onClose} className="text-xs text-dim hover:text-ash">
            close
          </button>
        </div>
        <div className="mb-3 text-[10px] text-dim">
          ★ = aesthetic ROI per unit of effort · timelines assume consistent training + food
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {MUSCLES_BY_ROI.map((m) => {
            const intel = MUSCLE_INTEL[m]
            const expanded = open === m
            return (
              <div
                key={m}
                className={`chip border transition-colors ${
                  expanded ? 'border-ember-dim bg-ember/5' : 'border-line bg-plate2'
                }`}
              >
                <button
                  onClick={() => setOpen(expanded ? null : m)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  <span className="flex-1 text-[13px] font-semibold text-bone">
                    {MUSCLE_LABEL[m]}
                  </span>
                  <span className="num shrink-0 text-[9px] text-dim">{intel.growth}</span>
                  <Stars n={intel.roi} />
                </button>
                {expanded && (
                  <div className="border-t border-line px-3 py-2.5">
                    <p className="text-[11px] leading-relaxed text-ash">{intel.note}</p>
                    <div className="mt-2 space-y-1">
                      {intel.best.map(({ exerciseId, stars }) => {
                        const ex = EXERCISE_MAP.get(exerciseId)
                        if (!ex) return null
                        return (
                          <div
                            key={exerciseId}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-[11px] text-bone">{ex.name}</span>
                            <Stars n={stars} dim />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
