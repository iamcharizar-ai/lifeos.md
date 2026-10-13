import { motion } from 'framer-motion'

export function ProgressRing({
  pct,
  label,
  size = 64,
}: {
  pct: number
  label: string
  size?: number
}) {
  const r = 27
  const c = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="-rotate-90" width={size} height={size}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#232d3d" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className={pct >= 1 ? 'text-gold' : 'text-ember'}
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - Math.min(pct, 1)) }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        />
      </svg>
      <div className="num absolute inset-0 flex items-center justify-center text-xs font-semibold text-bone">
        {label}
      </div>
    </div>
  )
}
