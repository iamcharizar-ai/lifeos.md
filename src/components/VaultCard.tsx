import { motion } from 'framer-motion'
import type { useVault } from '../lib/vaultSync'

export function VaultCard({ vault }: { vault: ReturnType<typeof useVault> }) {
  if (vault.status === 'unsupported') {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-600">
        📁 Direct vault write-back needs Chrome/Edge on PC — on this device it arrives with
        Supabase sync.
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Obsidian vault
          </div>
          <div className="mt-1 text-sm">
            {vault.status === 'ready' && (
              <span className="text-emerald-300">
                ● Linked — auto-writing to daily note
                {vault.lastWrite && (
                  <span className="text-zinc-500"> · last {vault.lastWrite}</span>
                )}
              </span>
            )}
            {vault.status === 'need-perm' && (
              <span className="text-amber-300">● Linked — needs re-authorization</span>
            )}
            {vault.status === 'disconnected' && (
              <span className="text-zinc-500">○ Not linked</span>
            )}
          </div>
          {vault.error && <div className="mt-1 text-xs text-rose-400">{vault.error}</div>}
        </div>

        {vault.status === 'disconnected' && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={vault.connect}
            className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-300"
          >
            Link vault folder
          </motion.button>
        )}
        {vault.status === 'need-perm' && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={vault.authorize}
            className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300"
          >
            Re-authorize
          </motion.button>
        )}
        {vault.status === 'ready' && (
          <button onClick={vault.disconnect} className="text-xs text-zinc-600 hover:text-zinc-400">
            unlink
          </button>
        )}
      </div>
    </div>
  )
}
