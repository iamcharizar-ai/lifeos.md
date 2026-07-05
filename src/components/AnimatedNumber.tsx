import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'

// Number ticker — springs to each new value (both directions). Uses the
// explicit animate() API: useSpring().set() is unreliable in motion v12.
export function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(value)
  const display = useTransform(mv, (v) => Math.round(v).toLocaleString('en-IN'))
  useEffect(() => {
    const controls = animate(mv, value, { type: 'spring', stiffness: 140, damping: 22 })
    return () => controls.stop()
  }, [value, mv])
  return <motion.span>{display}</motion.span>
}
