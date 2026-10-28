import { fullName } from '../store/db'
import type { Company, Person } from '../types'
import type { Option } from './Dropdown'

export const companyOptions = (companies: Company[]): Option[] =>
  [...companies]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name, sub: [c.city, c.industry].filter(Boolean).join(' · ') }))

export const personOptions = (people: Person[], companies: Company[]): Option[] =>
  [...people]
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
    .map((p) => ({
      value: p.id,
      label: fullName(p),
      sub: [p.role, ...p.companyIds.map((id) => companies.find((c) => c.id === id)?.name)].filter(Boolean).join(' · '),
    }))
