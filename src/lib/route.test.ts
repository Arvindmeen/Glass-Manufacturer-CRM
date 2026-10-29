import { describe, expect, it } from 'vitest'
import { googleMapsRoute, haversine, planRoute, splitLegs, TRIP_POINTS, type Point } from './route'

/** Deterministic pseudo-random points in the Bern region. */
function points(n: number, seed: number): Point[] {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: n }, () => ({ lat: 46.6 + rnd() * 0.6, lng: 7.2 + rnd() * 0.8 }))
}

const length = (pts: Point[], order: number[], start?: Point) =>
  order.reduce((d, i, k) => d + (k ? haversine(pts[order[k - 1]], pts[i]) : start ? haversine(start, pts[i]) : 0), 0)

function bruteForce(pts: Point[]) {
  let best = Infinity
  const perm = (a: number[], l: number) => {
    if (l === a.length) return void (best = Math.min(best, length(pts, a)))
    for (let i = l; i < a.length; i++) {
      ;[a[l], a[i]] = [a[i], a[l]]
      perm(a, l + 1)
      ;[a[l], a[i]] = [a[i], a[l]]
    }
  }
  perm(pts.map((_, i) => i), 0)
  return best
}

describe('planRoute', () => {
  it('visits every stop exactly once', () => {
    const pts = points(15, 7)
    const r = planRoute(pts)
    expect([...r.order].sort((a, b) => a - b)).toEqual(pts.map((_, i) => i))
  })

  it('matches the optimal open path for 8 stops', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const pts = points(8, seed)
      expect(planRoute(pts).km).toBeCloseTo(bruteForce(pts), 6)
    }
  })

  it('starts from the given position', () => {
    const pts = points(6, 11)
    const start = { lat: 46.95, lng: 7.45 }
    const r = planRoute(pts, start)
    expect(r.km).toBeCloseTo(length(pts, r.order, start), 6)
  })

  it('handles 0 and 1 stops', () => {
    expect(planRoute([]).order).toEqual([])
    expect(planRoute([{ lat: 46.9, lng: 7.4 }]).order).toEqual([0])
  })
})

describe('Google Maps links', () => {
  it('splits long routes into chained parts of at most 11 points', () => {
    const legs = splitLegs(Array.from({ length: 25 }, (_, i) => i), TRIP_POINTS)
    legs.forEach((l) => expect(l.length).toBeLessThanOrEqual(11))
    for (let i = 1; i < legs.length; i++) expect(legs[i][0]).toBe(legs[i - 1].at(-1))
    expect(legs.flat().filter((v, i, a) => a.indexOf(v) === i)).toHaveLength(25)
  })

  it('builds an api=1 directions link with origin, waypoints and destination', () => {
    const url = new URL(googleMapsRoute(['46.1,7.1', '46.2,7.2', '46.3,7.3']))
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/')
    expect(url.searchParams.get('origin')).toBe('46.1,7.1')
    expect(url.searchParams.get('waypoints')).toBe('46.2,7.2')
    expect(url.searchParams.get('destination')).toBe('46.3,7.3')
  })
})
