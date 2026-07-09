// Barcode capture for food logging — native BarcodeDetector over a live camera
// feed (Chrome/Android; the PWA's home turf), with a manual code entry fallback
// everywhere else. Emits the raw EAN/UPC string; product lookup is the caller's
// job (Open Food Facts in HealthScreen).
import { useEffect, useRef, useState } from 'react'

// BarcodeDetector is not in lib.dom yet — minimal surface we use
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

export function BarcodeScanner({
  onDetect,
  onClose,
}: {
  onDetect: (code: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const supported = Boolean(window.BarcodeDetector)

  useEffect(() => {
    if (!supported) return
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const detector = new window.BarcodeDetector!({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
    })

    const tick = async () => {
      const video = videoRef.current
      if (stopped || !video) return
      if (video.readyState >= 2) {
        try {
          const codes = await detector.detect(video)
          if (codes.length > 0) {
            onDetect(codes[0].rawValue)
            return // caller closes; stop scanning
          }
        } catch {
          /* per-frame detect failures are normal while focusing */
        }
      }
      raf = requestAnimationFrame(() => void tick())
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        if (video) {
          video.srcObject = s
          void video.play()
          raf = requestAnimationFrame(() => void tick())
        }
      })
      .catch(() => setError('camera unavailable — type the barcode below'))

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [supported, onDetect])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/90 p-4" onClick={onClose}>
      <div className="plate w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="hud-label">Scan barcode</span>
          <button onClick={onClose} className="text-xs text-dim hover:text-ash">
            close
          </button>
        </div>

        {supported && !error ? (
          <div className="relative overflow-hidden border border-line bg-ink">
            <video ref={videoRef} muted playsInline className="h-56 w-full object-cover" />
            {/* aim line */}
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-ember/80 shadow-[0_0_8px_#ff5c38]" />
          </div>
        ) : (
          <div className="border border-dashed border-line p-4 text-center text-xs text-dim">
            {error ?? 'this browser has no barcode detector — type the code instead'}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="or type EAN/UPC…"
            className="num min-w-0 flex-1 border border-line bg-plate2 px-3 py-2 text-sm text-bone outline-none focus:border-line2"
          />
          <button
            disabled={manual.length < 8}
            onClick={() => onDetect(manual)}
            className={`chip px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wider ${
              manual.length >= 8 ? 'bg-gold text-ink' : 'bg-plate2 text-dim'
            }`}
          >
            look up
          </button>
        </div>
      </div>
    </div>
  )
}
