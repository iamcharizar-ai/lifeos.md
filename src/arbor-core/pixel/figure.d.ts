export interface PoseSpec {
  t?: number
  hd?: number
  a?: [number, number]
  b?: [number, number]
  l?: [number, number]
  m?: [number, number]
  props?: string[]
  flip?: boolean
}
/** Side length of the square pixel grid. */
export const G: number
/** Rasterise a pose: G*G tones (0 empty · 1 near · 2 far · 3 prop · 4 motion mark). */
export function renderPose(spec: PoseSpec): Uint8Array
