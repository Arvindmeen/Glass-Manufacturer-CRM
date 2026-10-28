import { useState } from 'react'
import { Check, Globe, Loader2, Plus, Search } from 'lucide-react'
import { useT, type TKey } from '../i18n'
import { blankCompany, saveCompany, useDB } from '../store/db'
import { findCompany } from '../lib/interpret'
import { Select } from '../components/Dropdown'
import { Field, PageHead, toast } from '../components/ui'
import { useSettings, type Lang } from '../store/settings'

/* Static sample results — the search itself is a mockup by design. */

type LeadType = 'carpentry' | 'architecture' | 'plumbing' | 'windows' | 'interior'

interface Lead {
  name: string
  type: LeadType
  street: string
  zip: string
  city: string
  canton: string
  uid: string
  founded: number
  employees: number
  website: string
  signals: string[]
  fit: number
}

const LEADS: Lead[] = [
  { name: 'Schreinerei Aeschlimann GmbH', type: 'carpentry', street: 'Mühlegasse 4', zip: '3510', city: 'Konolfingen', canton: 'BE', uid: 'CHE-112.457.903', founded: 1987, employees: 14, website: 'aeschlimann-holz.ch', signals: ['Glass doors', 'Furniture glazing'], fit: 92 },
  { name: 'Holzwerk Blaser AG', type: 'carpentry', street: 'Industrieweg 12', zip: '3550', city: 'Langnau i.E.', canton: 'BE', uid: 'CHE-108.226.541', founded: 1994, employees: 28, website: 'holzwerk-blaser.ch', signals: ['Interior doors', 'Shop fitting'], fit: 87 },
  { name: 'Schreinerei Tschanz & Co.', type: 'carpentry', street: 'Dorfplatz 2', zip: '3627', city: 'Heimberg', canton: 'BE', uid: 'CHE-301.774.120', founded: 2009, employees: 6, website: 'tschanz-schreinerei.ch', signals: ['Kitchens', 'Glass splashbacks'], fit: 81 },
  { name: 'Möbelschreinerei Lüthi', type: 'carpentry', street: 'Bernstrasse 77', zip: '3122', city: 'Kehrsatz', canton: 'BE', uid: 'CHE-215.903.668', founded: 2001, employees: 9, website: 'luethi-moebel.ch', signals: ['Display cabinets'], fit: 74 },
  { name: 'Schreinerei Kohler Solothurn', type: 'carpentry', street: 'Werkhofstrasse 9', zip: '4500', city: 'Solothurn', canton: 'SO', uid: 'CHE-178.330.214', founded: 1979, employees: 18, website: 'kohler-schreinerei.ch', signals: ['Glass doors', 'Partitions'], fit: 85 },
  { name: 'Atelier Holz Fribourg SA', type: 'carpentry', street: 'Route de Bertigny 30', zip: '1700', city: 'Fribourg', canton: 'FR', uid: 'CHE-402.118.776', founded: 2012, employees: 11, website: 'atelier-holz.ch', signals: ['Shop fitting'], fit: 70 },
  { name: 'Graf Architekten AG', type: 'architecture', street: 'Spitalgasse 28', zip: '3011', city: 'Bern', canton: 'BE', uid: 'CHE-133.902.457', founded: 1998, employees: 22, website: 'graf-architekten.ch', signals: ['Facades', 'Public buildings'], fit: 90 },
  { name: 'Studio Raum & Licht', type: 'architecture', street: 'Obere Hauptgasse 50', zip: '3600', city: 'Thun', canton: 'BE', uid: 'CHE-389.551.002', founded: 2015, employees: 7, website: 'raumundlicht.ch', signals: ['Residential', 'Large glazing'], fit: 84 },
  { name: 'Wenger Zaugg Architekten', type: 'architecture', street: 'Bahnhofplatz 6', zip: '3400', city: 'Burgdorf', canton: 'BE', uid: 'CHE-227.640.319', founded: 2004, employees: 12, website: 'wz-architekten.ch', signals: ['Renovations', 'Housing cooperatives'], fit: 79 },
  { name: 'Archipel Planung GmbH', type: 'architecture', street: 'Murbacherstrasse 3', zip: '6003', city: 'Luzern', canton: 'LU', uid: 'CHE-460.229.845', founded: 2018, employees: 9, website: 'archipel-planung.ch', signals: ['Office interiors'], fit: 72 },
  { name: 'Baumann Hofer Architektur', type: 'architecture', street: 'Seestrasse 101', zip: '8002', city: 'Zürich', canton: 'ZH', uid: 'CHE-119.884.630', founded: 1991, employees: 31, website: 'baumann-hofer.ch', signals: ['Facades', 'Hotels'], fit: 88 },
  { name: 'Bad & Wellness Ryser AG', type: 'plumbing', street: 'Gewerbestrasse 15', zip: '3600', city: 'Thun', canton: 'BE', uid: 'CHE-140.776.532', founded: 1985, employees: 24, website: 'ryser-bad.ch', signals: ['Showers', 'Wellness'], fit: 94 },
  { name: 'Sanitär Feuz GmbH', type: 'plumbing', street: 'Hauptstrasse 40', zip: '3714', city: 'Frutigen', canton: 'BE', uid: 'CHE-316.208.994', founded: 2006, employees: 8, website: 'feuz-sanitaer.ch', signals: ['Bathroom renovation'], fit: 83 },
  { name: 'Haustechnik Studer AG', type: 'plumbing', street: 'Thunstrasse 120', zip: '3074', city: 'Muri b. Bern', canton: 'BE', uid: 'CHE-102.553.871', founded: 1972, employees: 45, website: 'studer-haustechnik.ch', signals: ['Showers', 'Large projects'], fit: 89 },
  { name: 'Badstudio Emme', type: 'plumbing', street: 'Kirchbergstrasse 8', zip: '3400', city: 'Burgdorf', canton: 'BE', uid: 'CHE-412.660.153', founded: 2016, employees: 5, website: 'badstudio-emme.ch', signals: ['Frameless showers'], fit: 86 },
  { name: 'Sanitas Bäder Aarau', type: 'plumbing', street: 'Bahnhofstrasse 70', zip: '5000', city: 'Aarau', canton: 'AG', uid: 'CHE-205.871.439', founded: 1999, employees: 16, website: 'sanitas-baeder.ch', signals: ['Showers'], fit: 77 },
  { name: 'Fensterbau Schweizer AG', type: 'windows', street: 'Industriering 22', zip: '3250', city: 'Lyss', canton: 'BE', uid: 'CHE-109.338.716', founded: 1968, employees: 52, website: 'schweizer-fenster.ch', signals: ['Triple glazing', 'Wood-aluminium'], fit: 91 },
  { name: 'Fenster Imhof GmbH', type: 'windows', street: 'Riedstrasse 5', zip: '3800', city: 'Matten b. Interlaken', canton: 'BE', uid: 'CHE-288.112.640', founded: 2002, employees: 13, website: 'imhof-fenster.ch', signals: ['Chalets', 'Renovation'], fit: 84 },
  { name: 'Alu-Fenster Mittelland', type: 'windows', street: 'Gäustrasse 18', zip: '4702', city: 'Oensingen', canton: 'SO', uid: 'CHE-371.904.225', founded: 2010, employees: 20, website: 'alufenster-mittelland.ch', signals: ['Aluminium systems'], fit: 76 },
  { name: 'Innenausbau Zürcher AG', type: 'interior', street: 'Freiburgstrasse 251', zip: '3018', city: 'Bern', canton: 'BE', uid: 'CHE-156.447.098', founded: 1990, employees: 35, website: 'zuercher-innenausbau.ch', signals: ['Glass partitions', 'Offices'], fit: 93 },
  { name: 'Raumwerk Thun GmbH', type: 'interior', street: 'Scheibenstrasse 6', zip: '3600', city: 'Thun', canton: 'BE', uid: 'CHE-433.019.582', founded: 2017, employees: 10, website: 'raumwerk-thun.ch', signals: ['Shop fitting', 'Mirrors'], fit: 82 },
  { name: 'Objekt & Form AG', type: 'interior', street: 'Pilatusstrasse 41', zip: '6003', city: 'Luzern', canton: 'LU', uid: 'CHE-240.786.311', founded: 2003, employees: 19, website: 'objektundform.ch', signals: ['Glass partitions'], fit: 78 },
]

const REGIONS = ['BE', 'SO', 'FR', 'LU', 'ZH', 'AG'] as const
const CANTONS: Record<Lang, Record<(typeof REGIONS)[number], string>> = {
  en: { BE: 'Bern', SO: 'Solothurn', FR: 'Fribourg', LU: 'Lucerne', ZH: 'Zurich', AG: 'Aargau' },
  de: { BE: 'Bern', SO: 'Solothurn', FR: 'Freiburg', LU: 'Luzern', ZH: 'Zürich', AG: 'Aargau' },
}
const TYPES: LeadType[] = ['carpentry', 'architecture', 'plumbing', 'windows', 'interior']
const INDUSTRY: Record<LeadType, string> = {
  carpentry: 'Carpentry',
  architecture: 'Architecture',
  plumbing: 'Plumbing',
  windows: 'Window maker',
  interior: 'Interior fit-out',
}

type Phase = 'idle' | 'register' | 'websites' | 'done'

export function LeadsPage() {
  const t = useT()
  const { lang } = useSettings()
  const db = useDB()
  const [region, setRegion] = useState<string>('BE')
  const [type, setType] = useState<LeadType>('carpentry')
  const [minEmployees, setMinEmployees] = useState(0)
  const [websiteOnly, setWebsiteOnly] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [results, setResults] = useState<Lead[]>([])

  const search = () => {
    setPhase('register')
    window.setTimeout(() => setPhase('websites'), 900)
    window.setTimeout(() => {
      const byType = LEADS.filter((l) => l.type === type && l.employees >= minEmployees)
      const inRegion = byType.filter((l) => !region || l.canton === region)
      // Static data: fall back to neighbouring regions so the list never looks empty.
      const list = inRegion.length >= 3 ? inRegion : [...inRegion, ...byType.filter((l) => !inRegion.includes(l))]
      setResults(list.sort((a, b) => b.fit - a.fit))
      setPhase('done')
    }, 1900)
  }

  const add = (l: Lead) => {
    saveCompany(
      blankCompany({
        name: l.name,
        industry: INDUSTRY[l.type],
        street: l.street,
        zip: l.zip,
        city: l.city,
        website: l.website,
        notes: `Lead · ${t('leads.source')} ${l.uid} · ${l.signals.join(', ')}`,
      }),
    )
    toast(t('leads.added'))
  }

  return (
    <>
      <PageHead title={t('nav.leads')} />
      <div className="card form" style={{ padding: 16 }}>
        <div className="row">
          <Field label={t('leads.region')} group>
            <Select
              label={t('leads.region')}
              value={region}
              onChange={(v) => setRegion(v ?? '')}
              options={[{ value: '', label: t('leads.any') }, ...REGIONS.map((r) => ({ value: r, label: CANTONS[lang][r], sub: r }))]}
            />
          </Field>
          <Field label={t('leads.type')} group>
            <Select
              label={t('leads.type')}
              value={type}
              onChange={(v) => v && setType(v as LeadType)}
              options={TYPES.map((x) => ({ value: x, label: t(`leads.${x}` as TKey) }))}
            />
          </Field>
        </div>
        <div className="row">
          <Field label={t('leads.minEmployees')} group>
            <div className="segmented">
              {[0, 5, 10, 20].map((n) => (
                <button key={n} type="button" className={minEmployees === n ? 'active' : ''} onClick={() => setMinEmployees(n)}>
                  {n === 0 ? t('leads.any') : `${n}+`}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t('field.website')} group>
            <button type="button" className={`toggle-chip${websiteOnly ? ' on' : ''}`} style={{ minHeight: 40, justifyContent: 'center' }} aria-pressed={websiteOnly} onClick={() => setWebsiteOnly((v) => !v)}>
              {websiteOnly ? <Check size={16} strokeWidth={3} /> : <Globe size={16} />} {t('leads.hasWebsite')}
            </button>
          </Field>
        </div>
        <button className="btn primary lg block" onClick={search} disabled={phase === 'register' || phase === 'websites'}>
          {phase === 'register' || phase === 'websites' ? <Loader2 size={18} className="spin" /> : <Search size={18} />}{' '}
          {phase === 'register' ? t('leads.searching') : phase === 'websites' ? t('leads.checking') : t('common.search')}
        </button>
      </div>

      {phase === 'done' && (
        <div className="section">
          <div className="section-head">
            <h2>{t('leads.results', { n: results.length })}</h2>
          </div>
          <div className="list">
            {results.map((l) => {
              const exists = !!findCompany(db, l.name)
              return (
                <div key={l.uid} className="list-item" style={{ alignItems: 'flex-start', cursor: 'default' }}>
                  <div className="grow">
                    <div className="title">{l.name}</div>
                    <div className="sub">
                      {l.zip} {l.city} · {l.canton} · {t('leads.employees', { n: l.employees })}
                    </div>
                    <div className="chips" style={{ marginTop: 6 }}>
                      <span className="chip ok">
                        <Check size={12} /> {l.website}
                      </span>
                      {l.signals.map((s) => (
                        <span key={s} className="chip">
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {t('leads.source')} {l.uid} · {l.founded}
                    </div>
                  </div>
                  <div className="stack" style={{ justifyItems: 'end', gap: 6 }}>
                    <span className="chip primary">
                      {t('leads.fit')} {l.fit}%
                    </span>
                    <button className={`btn small${exists ? '' : ' primary'}`} disabled={exists} onClick={() => add(l)}>
                      {exists ? <Check size={16} /> : <Plus size={16} />} {exists ? t('leads.added') : t('leads.addToCrm')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
