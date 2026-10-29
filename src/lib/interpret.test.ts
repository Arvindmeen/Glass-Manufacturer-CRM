import { describe, expect, it, vi } from 'vitest'

// resolve() is pure; the AI client and the browser store are not needed here.
vi.mock('./openai', () => ({ chatJSON: vi.fn() }))
vi.mock('../store/db', () => ({ fullName: (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim() }))

const { resolve, sameText, findCompany } = await import('./interpret')
const { seed } = await import('../store/seed')

const db = seed('en')

describe('findCompany', () => {
  it('recognises existing companies without legal form, case or small differences', () => {
    expect(findCompany(db, 'Schreinerei Huber')?.id).toBe('c1')
    expect(findCompany(db, 'schreinerei huber ag')?.id).toBe('c1')
    expect(findCompany(db, 'Glasbau Keller')?.id).toBe('c2')
    expect(findCompany(db, 'Totally New Glass GmbH')).toBeUndefined()
  })
})

describe('sameText', () => {
  it('treats rewording and typos as the same', () => {
    expect(sameText('Send quote for shower glass', 'Shower glass quote send')).toBe(true)
    expect(sameText('Call Anna on Friday', 'call anna friday')).toBe(true)
  })
  it('keeps different tasks apart', () => {
    expect(sameText('Send quote', 'Send invoice')).toBe(false)
    expect(sameText('Send offer for shower panels', 'Send quote for shower glass')).toBe(false)
  })
})

describe('resolve (voice command proposals)', () => {
  it('reuses an existing company and links new items to it', () => {
    const { items, known } = resolve(db, [
      { type: 'create_company', ref: 'new:c1', name: 'Schreinerei Huber', city: 'Thun' },
      { type: 'create_person', ref: 'new:p1', firstName: 'Lena', lastName: 'Test', companyRefs: ['new:c1'] },
      { type: 'create_task', title: 'Call Lena', companyRef: 'new:c1', personRef: 'new:p1' },
    ])
    expect(known.map((k) => k.kind)).toContain('create_company')
    expect(items.some((i) => i.proposal.kind === 'create_company')).toBe(false)
    const person = items.find((i) => i.proposal.kind === 'create_person')!.proposal
    const task = items.find((i) => i.proposal.kind === 'create_task')!.proposal
    expect(person).toMatchObject({ companyRefs: ['c1'] })
    expect(task).toMatchObject({ companyRef: 'c1', personRef: 'new:p1' })
  })

  it('every proposal starts undecided (nothing is saved without approval)', () => {
    const { items } = resolve(db, [{ type: 'create_task', title: 'Brand new audit task' }])
    expect(items.map((i) => i.decision)).toEqual(['pending'])
  })

  it('does not propose a task that already exists', () => {
    const { items, known } = resolve(db, [{ type: 'create_task', title: 'Send offer for shower panels', companyRef: 'c1' }])
    expect(items).toHaveLength(0)
    expect(known[0]).toMatchObject({ kind: 'create_task' })
  })

  it('turns a repeated task with a new person into an update of the existing one', () => {
    const withoutPerson = { ...db, tasks: [{ id: 'tx', title: 'Send offer for 20 tempered panels', due: '', status: 'planned' as const, companyId: 'c2', createdAt: '' }] }
    const { items } = resolve(withoutPerson, [{ type: 'create_task', title: 'Send offer for 20 tempered panels', companyRef: 'c2', personRef: 'p3' }])
    expect(items.map((i) => i.proposal)).toEqual([expect.objectContaining({ kind: 'update_task', taskId: 'tx', personRef: 'p3' })])
  })

  it('drops references to records that do not exist', () => {
    const { items } = resolve(db, [{ type: 'create_task', title: 'Ghost link task', companyRef: 'c999', personRef: 'p999' }])
    expect(items[0].proposal).toMatchObject({ companyRef: undefined, personRef: undefined })
  })

  it('keeps one copy when the same item is said twice in one message', () => {
    const { items } = resolve(db, [
      { type: 'create_task', title: 'Measure bathroom windows', companyRef: 'c1' },
      { type: 'create_task', title: 'Measure bathroom windows', companyRef: 'c1' },
    ])
    expect(items).toHaveLength(1)
  })
})
