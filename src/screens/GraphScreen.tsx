import { useEffect, useRef, useState } from 'react'
import ForceGraph from 'force-graph'

const GROUP_COLORS: Record<string, string> = {
  root: '#f4f4f5',
  mini: '#f472b6',
  archive: '#52525b',
  entity: '#fbbf24',
  topic: '#22d3ee',
  source: '#a78bfa',
  output: '#34d399',
  wiki: '#e4e4e7',
}

const GROUP_LABELS: Record<string, string> = {
  root: 'Root',
  mini: 'Mini Notes',
  archive: 'Archive',
  entity: 'Entities',
  topic: 'Topics',
  source: 'Sources',
  output: 'Outputs',
  wiki: 'Wiki meta',
}

interface GNode {
  id: string
  name: string
  group: string
  val: number
}

export function GraphScreen() {
  const ref = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<{ nodes: number; links: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let graph: InstanceType<typeof ForceGraph> | null = null
    fetch('/graph.json')
      .then((r) => {
        if (!r.ok) throw new Error('graph.json missing — run `npm run graph`')
        return r.json()
      })
      .then((data: { nodes: GNode[]; links: { source: string; target: string }[] }) => {
        setStats({ nodes: data.nodes.length, links: data.links.length })
        graph = new ForceGraph(el)
        graph
          .graphData(data)
          .width(el.clientWidth)
          .height(el.clientHeight)
          .backgroundColor('rgba(0,0,0,0)')
          .nodeLabel((n) => (n as GNode).name)
          .nodeColor((n) => GROUP_COLORS[(n as GNode).group] ?? '#71717a')
          .nodeVal((n) => (n as GNode).val)
          .nodeCanvasObjectMode(() => 'after')
          .nodeCanvasObject((n, ctx, scale) => {
            const node = n as GNode & { x: number; y: number }
            if (scale < 1.6) return
            ctx.font = `${Math.max(10 / scale, 2)}px sans-serif`
            ctx.textAlign = 'center'
            ctx.fillStyle = 'rgba(250,250,250,0.75)'
            ctx.fillText(node.name, node.x, node.y + 6 + node.val / 2)
          })
          .linkColor(() => 'rgba(255,255,255,0.12)')
          .linkWidth(1)
          .onNodeClick((n) => {
            const file = (n as GNode).id.replace(/\.md$/, '')
            window.open(`obsidian://open?vault=Obsidian%20Vault&file=${encodeURIComponent(file)}`)
          })
      })
      .catch((e: Error) => setErr(e.message))
    return () => {
      graph?._destructor()
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
        {Object.entries(GROUP_LABELS).map(([g, label]) => (
          <span key={g} className="flex items-center gap-1.5 text-[10px] text-ash">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: GROUP_COLORS[g] }}
            />
            {label}
          </span>
        ))}
      </div>

      <div
        ref={ref}
        className="plate h-[60vh] overflow-hidden"
      />

      {err ? (
        <div className="text-center text-xs text-ember">{err}</div>
      ) : (
        <div className="text-center text-[10px] text-dim">
          {stats && `${stats.nodes} notes · ${stats.links} links · `}
          drag to explore · scroll to zoom · click a node to open it in Obsidian · refresh with{' '}
          <span className="text-ash">npm run graph</span>
        </div>
      )}
    </div>
  )
}
