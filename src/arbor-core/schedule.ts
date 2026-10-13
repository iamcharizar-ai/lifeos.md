// The weekly gym split, shared so the coach can plan calisthenics around it and
// Life OS can show today's session. Strong owns the routines themselves; ids
// here match its routine ids.
import type { Category } from './meta.ts'

export interface GymDay {
  routineId: string
  name: string
  /** skill categories the morning block should stay away from (trained hard that evening) */
  avoid: Category[]
  /** categories the gym add-on skills are drawn from, in preference order */
  addon: Category[]
}

/** Indexed by Date#getDay(): 0 = Sunday. */
export const GYM_WEEK: GymDay[] = [
  { routineId: 'd7-arms-delts', name: 'Arms + Delts Pump', avoid: [], addon: ['bar', 'pull'] },
  { routineId: 'd1-chest-delts', name: 'Upper Chest + Side Delts', avoid: ['push'], addon: ['push'] },
  { routineId: 'd2-lats-biceps', name: 'Lats + Rear Delts + Biceps', avoid: ['pull'], addon: ['pull', 'bar'] },
  { routineId: 'd3-legs', name: 'Legs', avoid: ['legs'], addon: [] },
  { routineId: 'd4-delts-triceps', name: 'Side Delts + Triceps', avoid: ['push'], addon: ['push'] },
  { routineId: 'd5-back-biceps', name: 'Back Thickness + Biceps', avoid: ['pull'], addon: ['bar', 'pull'] },
  { routineId: 'd6-chest-flys', name: 'Chest Flys + Side Delts', avoid: ['push'], addon: ['push'] },
]

export const gymDayFor = (day: string): GymDay => GYM_WEEK[new Date(day + 'T12:00:00').getDay()]
