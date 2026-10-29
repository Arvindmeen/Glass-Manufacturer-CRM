export interface Point {
  lat: number
  lng: number
}

/** Great-circle distance in km. */
export function haversine(a: Point, b: Point) {
  const R = 6371
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Length of an open path through `order` (row/column `start` of `d` is the fixed start, if any). */
function pathLength(d: number[][], order: number[], start: number | null) {
  let len = start !== null && order.length ? d[start][order[0]] : 0
  for (let i = 1; i < order.length; i++) len += d[order[i - 1]][order[i]]
  return len
}

function nearestNeighbour(d: number[][], stops: number[], first: number, firstIsStop: boolean) {
  const left = new Set(stops)
  const order: number[] = []
  let cur = first
  if (firstIsStop) {
    order.push(first)
    left.delete(first)
  }
  while (left.size) {
    let best = -1
    for (const i of left) if (best < 0 || d[cur][i] < d[cur][best]) best = i
    order.push(best)
    left.delete(best)
    cur = best
  }
  return order
}

/**
 * Local search on an open path until no move helps:
 * 2-opt (reverse a segment) and Or-opt (move a run of 1–3 stops elsewhere, either way round).
 */
function improve(d: number[][], order: number[], start: number | null) {
  let best = order
  let bestLen = pathLength(d, best, start)
  const n = best.length
  // Missing neighbours (path ends) cost nothing.
  const cost = (a: number | undefined, b: number | undefined) => (a === undefined || b === undefined ? 0 : d[a][b])
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const prev = i > 0 ? best[i - 1] : (start ?? undefined)
        const next = best[k + 1]
        const delta = cost(prev, best[k]) + cost(best[i], next) - cost(prev, best[i]) - cost(best[k], next)
        if (delta < -1e-9) {
          best = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)]
          bestLen += delta
          improved = true
        }
      }
    }
    for (let len = 1; len <= 3 && len < n; len++) {
      for (let i = 0; i + len <= n; i++) {
        const seg = best.slice(i, i + len)
        const rest = [...best.slice(0, i), ...best.slice(i + len)]
        for (let j = 0; j <= rest.length; j++) {
          if (j === i) continue
          for (const s of len > 1 ? [seg, [...seg].reverse()] : [seg]) {
            const next = [...rest.slice(0, j), ...s, ...rest.slice(j)]
            const l = pathLength(d, next, start)
            if (l + 1e-9 < bestLen) {
              best = next
              bestLen = l
              improved = true
            }
          }
        }
      }
    }
  }
  return { order: best, km: bestLen }
}

/**
 * Order stops into a short open route.
 * With a start (the rep's position) the route begins there; without one every
 * stop is tried as the first stop and the shortest result wins.
 */
export function planRoute(points: Point[], start?: Point) {
  if (points.length < 2) return { order: points.map((_, i) => i), km: start && points.length ? haversine(start, points[0]) : 0 }
  const all = start ? [...points, start] : points
  const d = all.map((a) => all.map((b) => haversine(a, b)))
  const stops = points.map((_, i) => i)
  if (start) return improve(d, nearestNeighbour(d, stops, points.length, false), points.length)
  let best = { order: [] as number[], km: Infinity }
  for (const i of stops) {
    const r = improve(d, nearestNeighbour(d, stops, i, true), null)
    if (r.km < best.km) best = r
  }
  return best
}

/**
 * Google Maps takes at most 3 waypoints in mobile browsers (9 in the app), so long routes are split
 * into legs of up to 5 points (origin, 3 waypoints, destination). Each leg starts where the last one ended.
 */
export const LEG_POINTS = 5

export function splitLegs<T>(points: T[], size = LEG_POINTS): T[][] {
  if (points.length <= size) return [points]
  const legs: T[][] = []
  for (let i = 0; i < points.length - 1; i += size - 1) legs.push(points.slice(i, i + size))
  return legs
}

/** Google Maps directions link for one leg: first point is the origin, last the destination. */
export function googleMapsRoute(points: string[]) {
  const list = [...points]
  const params = new URLSearchParams({ api: '1', travelmode: 'driving', origin: list.shift() ?? '' })
  params.set('destination', list.pop() ?? '')
  if (list.length) params.set('waypoints', list.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function currentPosition(timeout = 5000): Promise<Point | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(undefined),
      { timeout, maximumAge: 300000 },
    )
  })
}
