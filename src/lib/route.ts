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

function pathLength(points: Point[], order: number[], start?: Point) {
  let d = start && order.length ? haversine(start, points[order[0]]) : 0
  for (let i = 1; i < order.length; i++) d += haversine(points[order[i - 1]], points[order[i]])
  return d
}

function nearestNeighbour(points: Point[], first: Point, skipFirst: number | null) {
  const left = new Set(points.map((_, i) => i))
  const order: number[] = []
  let cur = first
  if (skipFirst !== null) {
    order.push(skipFirst)
    left.delete(skipFirst)
  }
  while (left.size) {
    let best = -1
    let bestD = Infinity
    for (const i of left) {
      const d = haversine(cur, points[i])
      if (d < bestD) [best, bestD] = [i, d]
    }
    order.push(best)
    left.delete(best)
    cur = points[best]
  }
  return order
}

/** 2-opt on an open path: reverse segments while that shortens the route. */
function twoOpt(points: Point[], order: number[], start?: Point) {
  let best = order
  let bestLen = pathLength(points, best, start)
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const next = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)]
        const len = pathLength(points, next, start)
        if (len + 1e-9 < bestLen) {
          best = next
          bestLen = len
          improved = true
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
  if (points.length < 2) return { order: points.map((_, i) => i), km: 0 }
  if (start) return twoOpt(points, nearestNeighbour(points, start, null), start)
  let best = { order: [] as number[], km: Infinity }
  points.forEach((p, i) => {
    const r = twoOpt(points, nearestNeighbour(points, p, i))
    if (r.km < best.km) best = r
  })
  return best
}

/** Google Maps directions link. Without an origin, Maps starts at the phone's location. */
export function googleMapsRoute(stops: string[], fromCurrentLocation: boolean) {
  const params = new URLSearchParams({ api: '1', travelmode: 'driving' })
  const list = [...stops]
  if (!fromCurrentLocation) params.set('origin', list.shift()!)
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
