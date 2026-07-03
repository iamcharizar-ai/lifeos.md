import { motion } from 'framer-motion'
import type { useVault } from '../lib/vaultSync'

export function VaultCard({ vault }: { vault: ReturnType<typeof useVault> }) {
  if (vault.status === 'unsupported') {
    return (
      <div className="chip border border-dashed border-line p-4 text-center text-xs text-dim">
        📁 Direct vault write-back needs Chrome/Edge on PC — on this device it arrives with
        Supabase sync.
      </div>
    )
  }

  return (
    <div className="plate p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="hud-label">Obsidian vault</div>
          <div className="mt-1 text-sm">
            {vault.status === 'ready' && (
              <span className="text-sage">
                ● Linked — auto-writing to daily note
                {vault.lastWrite && <span className="text-ash"> · last {vault.lastWrite}</span>}
              </span>
            )}
            {vault.status === 'need-perm' && (
              <span className="text-gold">● Linked — needs re-authorization</span>
            )}
            {vault.status === 'disconnected' && <span className="text-ash">○ Not linked</span>}
          </div>
          {vault.error && <div className="mt-1 text-xs text-ember">{vault.error}</div>}
        </div>

        {vault.status === 'disconnected' && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={vault.connect}
            className="chip border border-line2 bg-plate2 px-3 py-2 text-xs font-semibold text-bone"
          >
            Link vault folder
          </motion.button>
        )}
        {vault.status === 'need-perm' && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={vault.authorize}
            className="chip border border-gold-dim bg-gold/10 px-3 py-2 text-xs font-semibold text-gold"
          >
            Re-authorize
          </motion.button>
        )}
        {vault.status === 'ready' && (
          <button onClick={vault.disconnect} className="text-xs text-dim hover:text-ash">
            unlink
          </button>
        )}
      </div>
    </div>
  )
}
