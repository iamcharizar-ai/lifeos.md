import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ForceGraph from 'force-graph'
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

// ── Designed layout: lanes per discipline, depth flows downward ────
// Not physics — every node is pinned, so the map reads as a route, not soup.
const LANE_W = 170
const SUB_W = 48
const ROW_H = 74
const PATHS = Object.keys(PATH_META) as PathId[]

function coords(s: Skill): { x: number; y: number } {
  const lane = PATHS.indexOf(s.path)
  return {
    x: lane * LANE_W + (s.pos[1] - 1) * SUB_W,
    y: s.pos[0] * ROW_H + (lane % 2) * 26,
  }
}

const STATE_FILL: Record<NodeState, string> = {
  unlocked: '#f0b429',
  training: '#ff5c38',
  available: '#161d29',
  locked: '#10151e',
}
const STATE_RING: Record<NodeState, string> = {
  unlocked: '#f0b429',
  training: '#ff5c38',
  available: '#e8ecf4',
  locked: '#232d3d',
}

const STATE_CHIP: Record<NodeState, { label: string; cls: string }> = {
  unlocked: { label: 'Unlocked', cls: 'text-gold border-gold-dim bg-gold/10' },
  training: { label: 'Training', cls: 'text-ember border-ember-dim bg-ember/10' },
  available: { label: 'Available', cls: 'text-bone border-line2 bg-plate2' },
  locked: { label: 'Locked', cls: 'text-dim border-line bg-plate' },
}

interface GNode {
  id: string
  x: number
  y: number
  fx: number
  fy: number
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
  const holder = useRef<HTMLDivElement>(null)
  const graphRef = useRef<InstanceType<typeof ForceGraph> | null>(null)
  const stateRef = useRef(skills)
  stateRef.current = skills
  const [selected, setSelected] = useState<Skill | null>(null)

  const totalUnlocked = SKILLS.filter((s) => skillStatus(skills, s) === 'unlocked').length

  useEffect(() => {
    const el = holder.current
    if (!el) return

    // x/y set directly: with cooldownTicks(0) the engine never ticks, so
    // fx/fy alone would never reach the draw coordinates.
    const nodes: GNode[] = SKILLS.map((s) => {
      const { x, y } = coords(s)
      return { id: s.id, x, y, fx: x, fy: y }
    })
    const links = SKILLS.flatMap((s) =>
      s.requires
        .filter((r) => SKILL_MAP.has(r))
        .map((r) => ({ source: r, target: s.id })),
    )

    // Link endpoints are raw string ids until force-graph resolves them to
    // node objects — accessors run in both phases, so handle both shapes.
    const skillOf = (ref: unknown): Skill | undefined => {
      const id =
        typeof ref === 'string' || typeof ref === 'number'
          ? String(ref)
          : String((ref as { id?: string | number } | null)?.id ?? '')
      return SKILL_MAP.get(id)
    }
    const stOf = (s: Skill) => nodeState(stateRef.current, s)
    const litLink = (l: { source: unknown }) => {
      const src = skillOf(l.source)
      return !!src && skillStatus(stateRef.current, src) === 'unlocked'
    }
    const frontierLink = (l: { source: unknown; target: unknown }) => {
      const src = skillOf(l.source)
      const tgt = skillOf(l.target)
      return (
        !!src &&
        !!tgt &&
        skillStatus(stateRef.current, src) === 'unlocked' &&
        skillStatus(stateRef.current, tgt) !== 'unlocked'
      )
    }

    const graph = new ForceGraph(el)
    graphRef.current = graph
    graph
      .graphData({ nodes, links })
      .width(el.clientWidth)
      .height(el.clientHeight)
      .backgroundColor('rgba(0,0,0,0)')
      // nodes are all pinned (fx/fy) — the engine can run freely without
      // moving anything; keep the paint loop alive for the edge particles
      .autoPauseRedraw(false)
      .enableNodeDrag(false)
      .nodeLabel(() => '')
      .linkColor((l) => {
        const src = skillOf((l as { source: unknown }).source)
        return src && litLink(l as { source: unknown }) ? PATH_META[src.path].hue : '#232d3d'
      })
      .linkWidth((l) => (litLink(l as { source: unknown }) ? 1.6 : 0.7))
      .linkLineDash((l) => (litLink(l as { source: unknown }) ? null : [2, 3]))
      .linkDirectionalParticles((l) =>
        frontierLink(l as { source: unknown; target: unknown }) ? 2 : 0,
      )
      .linkDirectionalParticleSpeed(0.004)
      .linkDirectionalParticleWidth(2.4)
      .linkDirectionalParticleColor((l) => {
        const src = skillOf((l as { source: unknown }).source)
        return src ? PATH_META[src.path].hue : '#232d3d'
      })
      .nodeCanvasObject((node, ctx, scale) => {
        if (import.meta.env.DEV) {
          const w = window as unknown as { __paints?: number }
          w.__paints = (w.__paints ?? 0) + 1
        }
        const s = skillOf(node as GNode)
        if (!s) return
        const st = stOf(s)
        const x = (node as GNode).x
        const y = (node as GNode).y
        const r = st === 'locked' ? 7 : 9

        // glow for active states
        if (st === 'unlocked' || st === 'training') {
          ctx.shadowColor = STATE_RING[st]
          ctx.shadowBlur = 10
        }
        ctx.beginPath()
        ctx.arc(x, y, r, 0, 2 * Math.PI)
        ctx.fillStyle = STATE_FILL[st]
        ctx.globalAlpha = st === 'locked' ? 0.75 : 1
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.lineWidth = st === 'available' ? 1.4 : 1
        ctx.strokeStyle = STATE_RING[st]
        ctx.stroke()
        ctx.globalAlpha = 1

        // glyph
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `${r * 1.1}px sans-serif`
        ctx.globalAlpha = st === 'locked' ? 0.5 : 1
        ctx.fillText(st === 'locked' ? '🔒' : s.emoji, x, y + 0.5)
        ctx.globalAlpha = 1

        // star marker
        if (s.star) {
          ctx.font = '6px sans-serif'
          ctx.fillText('⭐', x + r + 3, y - r + 1)
        }

        // name label — appears as you zoom in
        if (scale > 1.1) {
          ctx.font = `600 ${Math.max(4.5, 5.5)}px "IBM Plex Sans", sans-serif`
          ctx.fillStyle =
            st === 'locked' ? 'rgba(139,148,167,0.55)' : 'rgba(232,236,244,0.92)'
          ctx.fillText(s.name, x, y + r + 7)
        }
      })
      .nodePointerAreaPaint((node, color, ctx) => {
        const x = (node as GNode).x
        const y = (node as GNode).y
        ctx.beginPath()
        ctx.arc(x, y, 16, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()
      })
      .onRenderFramePost((ctx) => {
        // lane headers float in the void above each discipline
        PATHS.forEach((p, i) => {
          const meta = PATH_META[p]
          const x = i * LANE_W
          const y = -46 + (i % 2) * 26
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = '700 9px "Chakra Petch", sans-serif'
          ctx.fillStyle = meta.hue
          ctx.fillText(meta.label.toUpperCase(), x, y)
          const list = SKILLS.filter((s) => s.path === p)
          const done = list.filter((s) => skillStatus(stateRef.current, s) === 'unlocked').length
          ctx.font = '500 5.5px "IBM Plex Mono", monospace'
          ctx.fillStyle = 'rgba(139,148,167,0.8)'
          ctx.fillText(`${done}/${list.length}`, x, y + 10)
        })
      })
      .onNodeClick((node) => {
        const s = skillOf(node as GNode)
        if (s) setSelected(s)
      })
      .onBackgroundClick(() => setSelected(null))

    requestAnimationFrame(() => graph.zoomToFit(0, 40))
    if (import.meta.env.DEV) (window as unknown as { __tree?: unknown }).__tree = graph

    const onResize = () => {
      graph.width(el.clientWidth).height(el.clientHeight)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      graph._destructor()
      // StrictMode double-mounts: drop this instance's canvas from the DOM so
      // the remount's canvas isn't shadowed by a dead one
      el.replaceChildren()
      graphRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // state changes restyle in place — reassigning an accessor triggers repaint
  useEffect(() => {
    const g = graphRef.current
    if (g) g.linkColor(g.linkColor())
  }, [skills])

  return (
    <div className="bleed bleed-pad space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.22em] text-bone">
          Skill constellation
        </h2>
        <span className="num text-[11px] text-ash">
          <span className="text-gold">{totalUnlocked}</span>/{SKILLS.length} unlocked
        </span>
      </div>

      <div
        ref={holder}
        className="h-[68vh] w-full overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(22,29,41,0.55) 0%, rgba(10,13,19,0) 65%)',
        }}
      />

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] text-dim">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-gold" /> unlocked
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-ember" /> training
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border border-bone bg-plate2" />{' '}
          available
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border border-line bg-plate" /> locked
        </span>
        <span className="text-dim">· drag to roam · pinch/scroll to zoom · tap a node</span>
      </div>

      <AnimatePresence>
        {selected && (
          <DetailSheet
            key={selected.id}
            skill={selected}
            skills={skills}
            onSkill={onSkill}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
