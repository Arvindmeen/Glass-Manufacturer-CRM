import { describe, expect, it } from 'vitest'
import { sanitizeDB } from './validate'
import type { DB } from '../types'

const empty: DB = { companies: [], people: [], meetings: [], tasks: [], knowledge: [], emails: [] }

describe('sanitizeDB', () => {
  it('drops records without an id and non-objects', () => {
    const db = sanitizeDB({ ...empty, companies: [null, 'x', 5, {}, { id: '' }, { id: 'c1', name: 'Huber' }] }, empty)
    expect(db.companies.map((c) => c.id)).toEqual(['c1'])
  })

  it('coerces wrong types to safe defaults', () => {
    const db = sanitizeDB(
      {
        ...empty,
        people: [{ id: 'p1', firstName: 7, companyIds: 'c1' }],
        meetings: [{ id: 'm1', companyIds: ['c1', 3, null], personIds: null }],
        tasks: [{ id: 't1', status: 'weird', title: null, companyId: 5 }],
        knowledge: [{ id: 'k1', steps: ['plain text', { text: 'a', photo: 'data:image/png;base64,x' }, 4], tags: 'x' }],
        emails: [{ id: 'e1', body: null, read: 'yes', quote: { items: [{ product: 'ESG', quantity: '6' }, null] } }],
      },
      empty,
    )
    expect(db.people[0]).toMatchObject({ firstName: '7', companyIds: [], lastName: '' })
    expect(db.meetings[0]).toMatchObject({ companyIds: ['c1'], personIds: [] })
    expect(db.tasks[0]).toMatchObject({ status: 'planned', title: '', companyId: undefined })
    expect(db.knowledge[0].steps).toEqual([{ text: 'plain text' }, { text: 'a', photo: 'data:image/png;base64,x' }])
    expect(db.knowledge[0].tags).toEqual([])
    expect(db.emails[0]).toMatchObject({ body: '', read: false, quote: { items: [{ product: 'ESG', quantity: 6, dimensions: '' }] } })
  })

  it('removes duplicate ids, keeping the first', () => {
    const db = sanitizeDB({ ...empty, tasks: [{ id: 't1', title: 'first' }, { id: 't1', title: 'second' }] }, empty)
    expect(db.tasks.map((t) => t.title)).toEqual(['first'])
  })

  it('falls back for missing or malformed collections', () => {
    const fallback: DB = { ...empty, companies: [{ id: 'seed', name: 'Seed AG' } as DB['companies'][number]] }
    expect(sanitizeDB(null, fallback).companies[0].id).toBe('seed')
    expect(sanitizeDB({ companies: 'oops' }, fallback).companies[0].id).toBe('seed')
  })
})
