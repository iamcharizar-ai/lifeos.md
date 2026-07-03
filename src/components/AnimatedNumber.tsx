import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

export function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 140, damping: 22 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('en-IN'))
  useEffect(() => {
    spring.set(value)
  }, [value, spring])
  return <motion.span>{display}</motion.span>
}
