export function yearLabel(y: number) {
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`
}
