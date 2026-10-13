// Types for motion.js (the motion kit from the animation study; see MOTION-AUDIT.md).
export const config: { unit: number; speed: number; reduced: boolean }
export function setUnit(px: number): void
export const EASE: { linear: string; out: string; in: string; inOut: string; slam: string; snap: string }
export const T: Record<'fadeIn' | 'fadeOut' | 'pop' | 'slide' | 'slideLong' | 'stampIn' | 'exit' | 'claimBounceUp' | 'claimBounceDown', number>
export interface Tf { x?: number; y?: number; s?: number; sx?: number; sy?: number; r?: number }
export function tf(t?: Tf): string
export type Stop = [number, { t?: Tf; o?: number; f?: string }, string?]
export function K(total: number, stops: Stop[]): Keyframe[]
export interface RunOpts { dur: number; delay?: number; ease?: string; fill?: FillMode; iterations?: number }
export function run(el: Element | null | undefined, keyframes: Keyframe[], opts: RunOpts): Promise<unknown>
export function wait(ms: number): Promise<void>
export function stopAll(root: Element): void
export function flash(host: Element, color?: string, opts?: { dur?: number; peak?: number; ease?: string; delay?: number }): Promise<unknown>
type El = Element | null | undefined
export const motion: {
  fadeIn(el: El, d?: number, delay?: number): Promise<unknown>
  fadeOut(el: El, d?: number, delay?: number): Promise<unknown>
  popIn(el: El, o?: { delay?: number; from?: number; peak?: number }): Promise<unknown>
  slideUp(el: El, o?: { dist?: number; delay?: number }): Promise<unknown>
  stampIn(el: Element, o?: { delay?: number; from?: number; flashColor?: string }): Promise<unknown>
  slam(el: Element, o?: { from?: number; delay?: number; color?: string }): Promise<unknown>
  pulse(el: El, o?: { to?: number; up?: number; down?: number; delay?: number; glow?: string }): Promise<unknown>
  claimBounce(el: El, o?: { to?: number }): Promise<unknown>
  deployDrop(el: Element, o?: { height?: number; legendary?: boolean; delay?: number }): Promise<unknown>
  recoil(el: El, o?: { dir?: 'up' | 'down' | 'left' | 'right'; wobble?: boolean }): Promise<unknown>
  statusTint(el: Element, kind?: 'heal' | 'poison' | 'rage'): Promise<unknown>
  ringShock(host: Element, o?: { color?: string; size?: number; x?: number; y?: number; dur?: number; to?: number }): Promise<unknown>
  sunburst(el: El, o?: { deg?: number; dur?: number; delay?: number }): Promise<unknown>
  shineSweep(el: El, o?: { width?: number; delay?: number }): Promise<unknown>
  float(el: El, o?: { amp?: number; dur?: number }): Promise<unknown>
  countUp(el: Element, from: number, to: number, dur?: number, fmt?: (n: number) => string): Promise<void>
  floatText(el: El, o?: { rise?: number }): Promise<unknown>
}
export type RarityName = 'common' | 'rare' | 'epic' | 'legendary'
export const RARITY: Record<RarityName, { glow: string | null; add: string | null; lift: number; flare: boolean; extended?: boolean }>
export function confetti(host: Element, o?: { count?: number; colors?: string[]; spread?: number }): Promise<unknown>
export function evoShardInsert(o: { shards: Element[]; fresh?: number[]; frame?: Element | null; stagger?: number; onFull?: () => void }): Promise<void>
export function evoUnlocked(o: { dimmer: El; sunburst: El; rays?: El; bloom: El; card: El; title: El; wings?: Element[]; shine?: El; hold?: number; exit?: boolean }): Promise<void>
export function capsulePopup(box: El): Promise<unknown>
export function capsuleBurst(o: { box: El; host: Element; rarity?: RarityName; count?: number }): Promise<void>
export function cardFlip(o: { card: El; swap?: () => void; anticipation?: number }): Promise<void>
export function collectCard(o: { card: El; name: El; stamp: El; extras?: Element[]; hold?: number }): Promise<void>
export function upgradeCard(o: { card: El; glowHost: Element }): Promise<void>
export function toast(el: El, o?: { hold?: number }): Promise<void>
export function levelUp(o: { title: El; icon: El; button: El }): Promise<void>
