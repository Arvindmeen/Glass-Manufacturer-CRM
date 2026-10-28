export type ID = string

export interface Company {
  id: ID
  name: string
  industry: string
  street: string
  zip: string
  city: string
  phone: string
  email: string
  website: string
  lat?: number
  lng?: number
  notes: string
  createdAt: string
}

export interface Person {
  id: ID
  firstName: string
  lastName: string
  role: string
  phone: string
  email: string
  notes: string
  companyIds: ID[]
  createdAt: string
}

export interface Meeting {
  id: ID
  date: string
  title: string
  summary: string
  companyIds: ID[]
  personIds: ID[]
  createdAt: string
}

export type TaskStatus = 'planned' | 'in_progress' | 'done'

export interface Task {
  id: ID
  title: string
  due: string
  status: TaskStatus
  companyId?: ID
  personId?: ID
  createdAt: string
}

export interface KnowledgeStep {
  text: string
  image?: string
}

export interface KnowledgeEntry {
  id: ID
  section: string
  title: string
  product: string
  summary: string
  steps: KnowledgeStep[]
  tags: string[]
  createdAt: string
}

export interface QuoteItem {
  product: string
  quantity: number
  dimensions: string
}

export interface QuoteRequest {
  customer: string
  contact: string
  items: QuoteItem[]
  notes: string
}

export interface Email {
  id: ID
  fromName: string
  fromEmail: string
  subject: string
  body: string
  date: string
  read: boolean
  isQuote: boolean
  /** Confirmed extraction of a quote request. */
  quote?: QuoteRequest
  transferredAt?: string
}

export interface DB {
  companies: Company[]
  people: Person[]
  meetings: Meeting[]
  tasks: Task[]
  knowledge: KnowledgeEntry[]
  emails: Email[]
}
