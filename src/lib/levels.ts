// Ngazi zinakokotolewa kutokana na EduPoints. Badilisha majina na vizingiti upendavyo.
export const LEVELS = [
  { min: 0, name: 'Mgeni' },
  { min: 100, name: 'Mwanafunzi Mpya' },
  { min: 300, name: 'Mchapakazi' },
  { min: 700, name: 'Mjuzi' },
  { min: 1500, name: 'Bingwa' },
  { min: 3000, name: 'Nahodha wa Elimu' },
]

export function getLevel(points: number) {
  let idx = 0
  LEVELS.forEach((l, i) => {
    if (points >= l.min) idx = i
  })
  const current = LEVELS[idx]
  const next = LEVELS[idx + 1]
  const progress = next ? (points - current.min) / (next.min - current.min) : 1
  return { number: idx + 1, current, next, progress: Math.min(Math.max(progress, 0), 1) }
}
