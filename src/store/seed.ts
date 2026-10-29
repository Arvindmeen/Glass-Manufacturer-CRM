import { localISO } from '../lib/format'
import type { Company, DB, Email, KnowledgeEntry, Meeting, Person, Task } from '../types'
import { getSettings, type Lang } from './settings'

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return localISO(d)
}
const stamp = (offset: number, hour = 9) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, 15, 0, 0)
  return d.toISOString()
}

type C = Omit<Company, 'createdAt'>
const companies: C[] = [
  { id: 'c1', name: 'Schreinerei Huber AG', industry: 'Carpentry', street: 'Frutigenstrasse 42', zip: '3600', city: 'Thun', phone: '+41 33 222 41 10', email: 'info@huber-schreinerei.ch', website: 'huber-schreinerei.ch', lat: 46.7489, lng: 7.6279, notes: 'Long-standing customer. Prefers delivery Tuesday mornings.' },
  { id: 'c2', name: 'Glasbau Keller GmbH', industry: 'Glazier', street: 'Industriestrasse 8', zip: '3052', city: 'Zollikofen', phone: '+41 31 911 52 00', email: 'kontakt@glasbau-keller.ch', website: 'glasbau-keller.ch', lat: 46.9985, lng: 7.4611, notes: 'Orders large volumes of float glass. Pays within 10 days.' },
  { id: 'c3', name: 'Bader Architekten', industry: 'Architecture', street: 'Kramgasse 19', zip: '3011', city: 'Bern', phone: '+41 31 312 77 30', email: 'office@bader-arch.ch', website: 'bader-arch.ch', lat: 46.9479, lng: 7.4515, notes: 'Specifies glass facades for public buildings.' },
  { id: 'c4', name: 'Sanitär Zbinden AG', industry: 'Plumbing', street: 'Bahnhofstrasse 5', zip: '3700', city: 'Spiez', phone: '+41 33 654 18 80', email: 'info@zbinden-sanitaer.ch', website: 'zbinden-sanitaer.ch', lat: 46.6868, lng: 7.6787, notes: 'Shower enclosures for renovation projects.' },
  { id: 'c5', name: 'Fensterbau Lehmann', industry: 'Window maker', street: 'Gewerbeweg 3', zip: '3400', city: 'Burgdorf', phone: '+41 34 422 60 15', email: 'info@lehmann-fenster.ch', website: 'lehmann-fenster.ch', lat: 47.0559, lng: 7.6276, notes: 'Insulating glass units, triple glazing.' },
  { id: 'c6', name: 'Holzbau Wyss AG', industry: 'Timber construction', street: 'Sägestrasse 11', zip: '3800', city: 'Interlaken', phone: '+41 33 822 33 40', email: 'mail@wyss-holzbau.ch', website: 'wyss-holzbau.ch', lat: 46.6863, lng: 7.8632, notes: 'Chalet renovations, large panorama windows.' },
  { id: 'c7', name: 'Innenausbau Steiner', industry: 'Interior fit-out', street: 'Seftigenstrasse 210', zip: '3084', city: 'Wabern', phone: '+41 31 961 20 90', email: 'info@steiner-innenausbau.ch', website: 'steiner-innenausbau.ch', lat: 46.9285, lng: 7.4510, notes: 'Glass partitions for offices.' },
  { id: 'c8', name: 'Metallbau Gerber AG', industry: 'Metal construction', street: 'Aarestrasse 30', zip: '3110', city: 'Münsingen', phone: '+41 31 721 45 60', email: 'info@gerber-metallbau.ch', website: 'gerber-metallbau.ch', lat: 46.8730, lng: 7.5615, notes: 'Balcony railings with laminated safety glass.' },
  { id: 'c9', name: 'Küchenstudio Moser', industry: 'Kitchen studio', street: 'Marktgasse 14', zip: '3800', city: 'Unterseen', phone: '+41 33 823 11 77', email: 'hallo@kuechen-moser.ch', website: 'kuechen-moser.ch', lat: 46.6875, lng: 7.8485, notes: 'Coloured glass splashbacks.' },
  { id: 'c10', name: 'Baugenossenschaft Aaretal', industry: 'Housing cooperative', street: 'Thunstrasse 88', zip: '3110', city: 'Münsingen', phone: '+41 31 724 10 10', email: 'verwaltung@bg-aaretal.ch', website: 'bg-aaretal.ch', lat: 46.8770, lng: 7.5650, notes: 'Renovation programme 2027: 64 flats.' },
  { id: 'c11', name: 'Architekturbüro Frei & Partner', industry: 'Architecture', street: 'Bälliz 21', zip: '3600', city: 'Thun', phone: '+41 33 221 90 50', email: 'info@frei-partner.ch', website: 'frei-partner.ch', lat: 46.7578, lng: 7.6283, notes: '' },
  { id: 'c12', name: 'Schreinerei Rüegsegger', industry: 'Carpentry', street: 'Dorfstrasse 7', zip: '3532', city: 'Zäziwil', phone: '+41 31 711 15 25', email: 'info@rueegsegger-holz.ch', website: 'rueegsegger-holz.ch', lat: 46.9035, lng: 7.6620, notes: 'Small shop, orders glass doors for furniture.' },
  { id: 'c13', name: 'Hotel Bellevue Seeblick', industry: 'Hospitality', street: 'Seestrasse 1', zip: '3654', city: 'Gunten', phone: '+41 33 251 80 80', email: 'technik@bellevue-seeblick.ch', website: 'bellevue-seeblick.ch', lat: 46.7120, lng: 7.6990, notes: 'Wellness area renovation, glass walls.' },
  { id: 'c14', name: 'Fassadentechnik Brunner AG', industry: 'Facade engineering', street: 'Riedbachstrasse 50', zip: '3027', city: 'Bern', phone: '+41 31 992 70 00', email: 'info@brunner-fassaden.ch', website: 'brunner-fassaden.ch', lat: 46.9530, lng: 7.3830, notes: 'Structural glazing, needs heat-soak tested ESG.' },
  { id: 'c15', name: 'Bad & Raum Kunz', industry: 'Bathroom design', street: 'Hauptstrasse 61', zip: '3250', city: 'Lyss', phone: '+41 32 384 22 44', email: 'info@badraum-kunz.ch', website: 'badraum-kunz.ch', lat: 47.0745, lng: 7.3070, notes: 'Frameless showers, prefers 8 mm ESG clear.' },
]

type P = Omit<Person, 'createdAt' | 'notes'> & { notes?: string }
const people: P[] = [
  { id: 'p1', firstName: 'Anna', lastName: 'Meier', role: 'Project manager', phone: '+41 79 412 33 21', email: 'a.meier@huber-schreinerei.ch', companyIds: ['c1'] },
  { id: 'p2', firstName: 'Thomas', lastName: 'Huber', role: 'Owner', phone: '+41 79 300 12 45', email: 't.huber@huber-schreinerei.ch', companyIds: ['c1'] },
  { id: 'p3', firstName: 'Markus', lastName: 'Keller', role: 'Managing director', phone: '+41 79 555 20 10', email: 'm.keller@glasbau-keller.ch', companyIds: ['c2'] },
  { id: 'p4', firstName: 'Sandra', lastName: 'Rossi', role: 'Purchasing', phone: '+41 78 633 41 90', email: 's.rossi@glasbau-keller.ch', companyIds: ['c2'] },
  { id: 'p5', firstName: 'Lukas', lastName: 'Bader', role: 'Architect, partner', phone: '+41 79 214 88 30', email: 'l.bader@bader-arch.ch', companyIds: ['c3'] },
  { id: 'p6', firstName: 'Julia', lastName: 'Frey', role: 'Architect', phone: '+41 76 401 22 18', email: 'j.frey@bader-arch.ch', companyIds: ['c3', 'c11'], notes: 'Works part-time for both offices.' },
  { id: 'p7', firstName: 'Peter', lastName: 'Zbinden', role: 'Owner', phone: '+41 79 677 30 02', email: 'p.zbinden@zbinden-sanitaer.ch', companyIds: ['c4'] },
  { id: 'p8', firstName: 'Reto', lastName: 'Lehmann', role: 'Head of production', phone: '+41 79 288 47 61', email: 'r.lehmann@lehmann-fenster.ch', companyIds: ['c5'] },
  { id: 'p9', firstName: 'Claudia', lastName: 'Wyss', role: 'Managing director', phone: '+41 79 133 50 90', email: 'c.wyss@wyss-holzbau.ch', companyIds: ['c6'] },
  { id: 'p10', firstName: 'Daniel', lastName: 'Steiner', role: 'Owner', phone: '+41 78 744 61 10', email: 'd.steiner@steiner-innenausbau.ch', companyIds: ['c7'] },
  { id: 'p11', firstName: 'Nicole', lastName: 'Gerber', role: 'Sales', phone: '+41 79 522 08 66', email: 'n.gerber@gerber-metallbau.ch', companyIds: ['c8'] },
  { id: 'p12', firstName: 'Stefan', lastName: 'Gerber', role: 'Workshop manager', phone: '+41 79 522 08 67', email: 's.gerber@gerber-metallbau.ch', companyIds: ['c8'] },
  { id: 'p13', firstName: 'Sabrina', lastName: 'Moser', role: 'Kitchen designer', phone: '+41 76 390 14 55', email: 's.moser@kuechen-moser.ch', companyIds: ['c9'] },
  { id: 'p14', firstName: 'Martin', lastName: 'Aebi', role: 'Facility manager', phone: '+41 79 830 27 19', email: 'm.aebi@bg-aaretal.ch', companyIds: ['c10'] },
  { id: 'p15', firstName: 'Barbara', lastName: 'Frei', role: 'Architect, owner', phone: '+41 79 455 63 02', email: 'b.frei@frei-partner.ch', companyIds: ['c11'] },
  { id: 'p16', firstName: 'Hans', lastName: 'Rüegsegger', role: 'Owner', phone: '+41 79 640 51 23', email: 'h.rueegsegger@rueegsegger-holz.ch', companyIds: ['c12'] },
  { id: 'p17', firstName: 'Michael', lastName: 'Schmid', role: 'Technical manager', phone: '+41 79 701 39 84', email: 'm.schmid@bellevue-seeblick.ch', companyIds: ['c13'] },
  { id: 'p18', firstName: 'Andrea', lastName: 'Brunner', role: 'Project engineer', phone: '+41 78 912 40 27', email: 'a.brunner@brunner-fassaden.ch', companyIds: ['c14'] },
  { id: 'p19', firstName: 'Simon', lastName: 'Brunner', role: 'CEO', phone: '+41 79 912 40 01', email: 's.brunner@brunner-fassaden.ch', companyIds: ['c14'] },
  { id: 'p20', firstName: 'Corinne', lastName: 'Kunz', role: 'Owner', phone: '+41 79 366 72 48', email: 'c.kunz@badraum-kunz.ch', companyIds: ['c15'] },
  { id: 'p21', firstName: 'Fabian', lastName: 'Kunz', role: 'Installer', phone: '+41 79 366 72 49', email: 'f.kunz@badraum-kunz.ch', companyIds: ['c15', 'c4'], notes: 'Freelance installer, also works for Zbinden.' },
  { id: 'p22', firstName: 'Monika', lastName: 'Imhof', role: 'Bookkeeping', phone: '+41 33 222 41 12', email: 'buchhaltung@huber-schreinerei.ch', companyIds: ['c1'] },
  { id: 'p23', firstName: 'Patrick', lastName: 'Studer', role: 'Site manager', phone: '+41 79 207 66 35', email: 'p.studer@wyss-holzbau.ch', companyIds: ['c6'] },
  { id: 'p24', firstName: 'Laura', lastName: 'Baumann', role: 'Interior architect', phone: '+41 76 585 11 72', email: 'l.baumann@steiner-innenausbau.ch', companyIds: ['c7', 'c3'] },
  { id: 'p25', firstName: 'Urs', lastName: 'Hofer', role: 'Board president', phone: '+41 79 318 90 44', email: 'u.hofer@bg-aaretal.ch', companyIds: ['c10'] },
]

const meetings: Omit<Meeting, 'createdAt'>[] = [
  { id: 'm1', date: day(-3), title: 'Shower panels for apartment block', summary: 'Anna needs 8 mm ESG clear panels for 6 bathrooms. Wants samples of matt finish. Decision by end of month.', companyIds: ['c1'], personIds: ['p1'] },
  { id: 'm2', date: day(-10), title: 'Annual pricing review', summary: 'Agreed 3 % volume discount from 500 m² per year. Markus asked about faster delivery to Zollikofen.', companyIds: ['c2'], personIds: ['p3', 'p4'] },
  { id: 'm3', date: day(-6), title: 'School facade, Bern West', summary: 'Facade with triple insulating glass, Ug 0.5. Lukas sends plans next week. Competing with two other suppliers.', companyIds: ['c3'], personIds: ['p5', 'p6'] },
  { id: 'm4', date: day(-14), title: 'Balcony railings', summary: 'Laminated safety glass VSG 2x8 mm for 40 railings. Nicole needs edge processing details.', companyIds: ['c8'], personIds: ['p11', 'p12'] },
  { id: 'm5', date: day(-2), title: 'Wellness area walls', summary: 'Michael wants frosted glass walls with logo engraving. Site visit planned.', companyIds: ['c13'], personIds: ['p17'] },
  { id: 'm6', date: day(-20), title: 'Renovation programme 2027', summary: 'Window replacement for 64 flats in three stages. Martin will invite to tender in spring.', companyIds: ['c10'], personIds: ['p14', 'p25'] },
  { id: 'm7', date: day(-8), title: 'Splashback samples', summary: 'Showed RAL colour samples. Sabrina likes anthracite and sage green. Orders 3 kitchens per month.', companyIds: ['c9'], personIds: ['p13'] },
  { id: 'm8', date: day(-1), title: 'Frameless shower complaint', summary: 'One panel delivered with chipped edge. Replacement promised within a week. Corinne otherwise satisfied.', companyIds: ['c15'], personIds: ['p20', 'p21'] },
  { id: 'm9', date: day(-12), title: 'Office partitions', summary: 'Glass partitions for a 600 m² office in Bern. Daniel and Laura need acoustic glass offer.', companyIds: ['c7'], personIds: ['p10', 'p24'] },
  { id: 'm10', date: day(-25), title: 'Structural glazing project', summary: 'Heat-soak tested ESG required. Andrea sends static calculations.', companyIds: ['c14'], personIds: ['p18'] },
]

const tasks: Omit<Task, 'createdAt'>[] = [
  { id: 't1', title: 'Send offer for shower panels', due: day(2), status: 'planned', companyId: 'c1', personId: 'p1' },
  { id: 't2', title: 'Bring matt finish samples', due: day(4), status: 'planned', companyId: 'c1', personId: 'p1' },
  { id: 't3', title: 'Check delivery slots Zollikofen', due: day(1), status: 'in_progress', companyId: 'c2', personId: 'p3' },
  { id: 't4', title: 'Prepare facade quote, Ug 0.5', due: day(7), status: 'planned', companyId: 'c3', personId: 'p5' },
  { id: 't5', title: 'Send edge processing spec', due: day(-1), status: 'in_progress', companyId: 'c8', personId: 'p11' },
  { id: 't6', title: 'Site visit wellness area', due: day(3), status: 'planned', companyId: 'c13', personId: 'p17' },
  { id: 't7', title: 'Replace chipped shower panel', due: day(5), status: 'in_progress', companyId: 'c15', personId: 'p20' },
  { id: 't8', title: 'Acoustic glass offer', due: day(6), status: 'planned', companyId: 'c7', personId: 'p24' },
  { id: 't9', title: 'Send RAL colour chart', due: day(-4), status: 'done', companyId: 'c9', personId: 'p13' },
  { id: 't10', title: 'Follow up tender invitation', due: day(30), status: 'planned', companyId: 'c10', personId: 'p14' },
  { id: 't11', title: 'Annual discount confirmation', due: day(-7), status: 'done', companyId: 'c2', personId: 'p4' },
  { id: 't12', title: 'Visit new chalet project', due: day(9), status: 'planned', companyId: 'c6', personId: 'p9' },
]

const knowledge: Omit<KnowledgeEntry, 'createdAt'>[] = [
  {
    id: 'k1', section: 'installation', title: 'Frameless shower panel', product: 'ESG 8 mm shower panel',
    summary: 'Wall-mounted frameless panel with clamps and stabiliser bar.',
    tags: ['shower', 'ESG', 'bathroom'],
    steps: [
      { text: 'Check the wall is plumb and tiled. Mark clamp positions 200 mm from top and bottom edge.', image: 'Mark clamp positions' },
      { text: 'Drill 6 mm holes, insert plugs and fix the wall clamps. Do not overtighten.', image: 'Fix wall clamps' },
      { text: 'Place the panel on two 6 mm setting blocks. Insert into the clamps with the rubber gaskets.', image: 'Set the panel' },
      { text: 'Fit the stabiliser bar at 2000 mm height. Check level and tighten all screws.', image: 'Stabiliser bar' },
      { text: 'Remove setting blocks and seal the bottom edge with transparent silicone. Leave 24 h before use.', image: 'Seal bottom edge' },
    ],
  },
  {
    id: 'k2', section: 'installation', title: 'Glass balcony railing', product: 'VSG 2x8 mm railing',
    summary: 'Base-profile railing with laminated safety glass.',
    tags: ['railing', 'VSG', 'outdoor'],
    steps: [
      { text: 'Anchor the aluminium base profile every 300 mm. Check the load table for the anchor type.', image: 'Anchor base profile' },
      { text: 'Insert the glass with suction lifters. Two people minimum.', image: 'Insert glass' },
      { text: 'Wedge the glass with the clamping inserts. Adjust vertical with the adjusting key.', image: 'Clamp and adjust' },
      { text: 'Fit the top handrail cap and the cover strips.', image: 'Handrail cap' },
    ],
  },
  {
    id: 'k3', section: 'installation', title: 'Kitchen splashback', product: 'Coloured ESG 6 mm splashback',
    summary: 'Bonded splashback with cut-outs for sockets.',
    tags: ['kitchen', 'ESG', 'bonding'],
    steps: [
      { text: 'Clean the wall. It must be dry, flat and free of dust.', image: 'Clean the wall' },
      { text: 'Apply mirror adhesive in vertical stripes, 10 cm apart. Never use acid silicone.', image: 'Apply adhesive' },
      { text: 'Press the panel on, aligning cut-outs with the sockets. Support for 24 h.', image: 'Press panel' },
    ],
  },
  {
    id: 'k4', section: 'installation', title: 'Office glass partition', product: 'VSG acoustic partition 10 mm',
    summary: 'Floor-to-ceiling partition in U-profiles.',
    tags: ['office', 'acoustic', 'partition'],
    steps: [
      { text: 'Fix ceiling and floor U-profiles in one line. Use a laser.', image: 'Fix U-profiles' },
      { text: 'Insert the panel top first, then lower into the floor profile.', image: 'Insert panel' },
      { text: 'Fill the gaps with the acoustic gasket on both sides.', image: 'Acoustic gasket' },
      { text: 'Join panels with transparent H-profiles or butt-joint tape.', image: 'Join panels' },
    ],
  },
  {
    id: 'k5', section: 'products', title: 'ESG vs. VSG', product: 'Safety glass',
    summary: 'ESG (tempered) breaks into small crumbs. VSG (laminated) stays in one piece thanks to the PVB foil. Railings and overhead glazing need VSG; showers usually ESG.',
    tags: ['ESG', 'VSG', 'basics'], steps: [],
  },
  {
    id: 'k6', section: 'troubleshooting', title: 'Condensation between panes', product: 'Insulating glass unit',
    summary: 'Condensation inside an IGU means the edge seal failed. The unit must be replaced; it cannot be repaired. Check warranty date on the spacer.',
    tags: ['IGU', 'warranty'], steps: [],
  },
  {
    id: 'k7', section: 'sales', title: 'Lead times', product: 'All products',
    summary: 'Float glass cut-to-size: 3 days. ESG: 7 days. VSG: 10 days. Coloured ESG: 12 days. Heat-soak test adds 2 days.',
    tags: ['delivery', 'lead time'], steps: [],
  },
]

const emails: Email[] = [
  {
    id: 'e1', fromName: 'Peter Zbinden', fromEmail: 'p.zbinden@zbinden-sanitaer.ch', date: stamp(0, 8), read: false, isQuote: true,
    subject: 'Quote request: shower partitions',
    body: 'Hello\n\nFor an apartment building in Spiez we need a quote for:\n\n- 6 pcs shower panels ESG 8 mm clear, 900 x 2000 mm\n- 6 pcs swing doors ESG 8 mm clear, 800 x 2000 mm\n- 6 pcs stabiliser bars, chrome\n\nDelivery would be week 49. Please reply by the end of the week.\n\nKind regards\nPeter Zbinden\nSanitär Zbinden AG',
  },
  {
    id: 'e2', fromName: 'Laura Baumann', fromEmail: 'l.baumann@steiner-innenausbau.ch', date: stamp(-1, 14), read: false, isQuote: true,
    subject: 'Quote request: acoustic glass partitions',
    body: 'Hello,\n\nas discussed with Daniel, please send us a quote for the office project in Bern:\n\n- 14 panels VSG acoustic 10 mm, 1200 x 2800 mm\n- 2 glass doors ESG 10 mm, 1000 x 2200 mm, with handles\n\nDelivery to site in January.\n\nBest regards\nLaura Baumann',
  },
  {
    id: 'e3', fromName: 'Sabrina Moser', fromEmail: 's.moser@kuechen-moser.ch', date: stamp(-1, 9), read: true, isQuote: true,
    subject: 'Kitchen splashbacks – 3 kitchens',
    body: 'Hi all\n\nI need a quote for three coloured kitchen splashbacks ESG 6 mm:\n\n1. Anthracite RAL 7016, 3200 x 650 mm, 2 socket cut-outs\n2. Sage green, 2400 x 600 mm\n3. White RAL 9010, 2800 x 650 mm, 3 socket cut-outs\n\nThanks and best wishes\nSabrina',
  },
  {
    id: 'e4', fromName: 'Martin Aebi', fromEmail: 'm.aebi@bg-aaretal.ch', date: stamp(-2, 11), read: true, isQuote: false,
    subject: 'Site inspection date',
    body: 'Hello\n\nCan we move the inspection of the estate to the 12th? The caretaker is not available on the original date.\n\nRegards\nMartin Aebi',
  },
  {
    id: 'e5', fromName: 'Hotel Bellevue Seeblick', fromEmail: 'technik@bellevue-seeblick.ch', date: stamp(-3, 16), read: true, isQuote: true,
    subject: 'Glass walls for the wellness area',
    body: 'Dear Sir or Madam\n\nWe are planning to renovate our wellness area and would like a quote for:\n\n- 5 glass walls ESG 10 mm satin, 1500 x 2400 mm, with logo engraving\n- 1 all-glass door ESG 10 mm satin, 900 x 2100 mm\n\nYours sincerely\nMichael Schmid\nTechnical manager',
  },
  {
    id: 'e6', fromName: 'Corinne Kunz', fromEmail: 'c.kunz@badraum-kunz.ch', date: stamp(-4, 10), read: true, isQuote: false,
    subject: 'Re: Replacement glass',
    body: 'Thanks for the quick reply. The replacement can be delivered straight to the site in Lyss.\n\nCorinne',
  },
  {
    id: 'e7', fromName: 'Glas-Fachverband Newsletter', fromEmail: 'news@glas-fachverband.example', date: stamp(-5, 7), read: true, isQuote: false,
    subject: 'Swissbau 2027 trade fair – save the date',
    body: 'Swissbau takes place in Basel from 19 to 22 January 2027.',
  },
]

/* ---------- German texts of the demo data (names, addresses and numbers stay as they are) ---------- */

type Step = { text: string; image?: string }
export type SeedText = Record<string, string | string[] | Step[]>

const DE: Record<string, SeedText> = {
  c1: { industry: 'Schreinerei', notes: 'Langjähriger Kunde. Lieferung am liebsten dienstagmorgens.' },
  c2: { industry: 'Glaserei', notes: 'Bestellt grosse Mengen Floatglas. Zahlt innert 10 Tagen.' },
  c3: { industry: 'Architektur', notes: 'Plant Glasfassaden für öffentliche Bauten.' },
  c4: { industry: 'Sanitär', notes: 'Duschabtrennungen für Sanierungsprojekte.' },
  c5: { industry: 'Fensterbau', notes: 'Isolierglas, Dreifachverglasung.' },
  c6: { industry: 'Holzbau', notes: 'Chalet-Renovationen, grosse Panoramafenster.' },
  c7: { industry: 'Innenausbau', notes: 'Glastrennwände für Büros.' },
  c8: { industry: 'Metallbau', notes: 'Balkongeländer mit Verbundsicherheitsglas.' },
  c9: { industry: 'Küchenstudio', notes: 'Farbige Glasrückwände.' },
  c10: { industry: 'Wohnbaugenossenschaft', notes: 'Sanierungsprogramm 2027: 64 Wohnungen.' },
  c11: { industry: 'Architektur' },
  c12: { industry: 'Schreinerei', notes: 'Kleiner Betrieb, bestellt Glastüren für Möbel.' },
  c13: { industry: 'Hotellerie', notes: 'Umbau Wellnessbereich, Glaswände.' },
  c14: { industry: 'Fassadenbau', notes: 'Structural Glazing, braucht heissgelagertes ESG (Heat-Soak-Test).' },
  c15: { industry: 'Badgestaltung', notes: 'Rahmenlose Duschen, bevorzugt ESG 8 mm klar.' },

  p1: { role: 'Projektleiterin' },
  p2: { role: 'Inhaber' },
  p3: { role: 'Geschäftsführer' },
  p4: { role: 'Einkauf' },
  p5: { role: 'Architekt, Partner' },
  p6: { role: 'Architektin', notes: 'Arbeitet Teilzeit für beide Büros.' },
  p7: { role: 'Inhaber' },
  p8: { role: 'Produktionsleiter' },
  p9: { role: 'Geschäftsführerin' },
  p10: { role: 'Inhaber' },
  p11: { role: 'Verkauf' },
  p12: { role: 'Werkstattleiter' },
  p13: { role: 'Küchenplanerin' },
  p14: { role: 'Facility Manager' },
  p15: { role: 'Architektin, Inhaberin' },
  p16: { role: 'Inhaber' },
  p17: { role: 'Technischer Leiter' },
  p18: { role: 'Projektingenieurin' },
  p19: { role: 'CEO' },
  p20: { role: 'Inhaberin' },
  p21: { role: 'Monteur', notes: 'Freischaffender Monteur, arbeitet auch für Zbinden.' },
  p22: { role: 'Buchhaltung' },
  p23: { role: 'Bauleiter' },
  p24: { role: 'Innenarchitektin' },
  p25: { role: 'Präsident Vorstand' },

  m1: { title: 'Duschwände für Mehrfamilienhaus', summary: 'Anna braucht ESG 8 mm klar für 6 Bäder. Möchte Muster in matt. Entscheid bis Ende Monat.' },
  m2: { title: 'Jährliche Preisbesprechung', summary: '3 % Mengenrabatt ab 500 m² pro Jahr vereinbart. Markus fragte nach schnellerer Lieferung nach Zollikofen.' },
  m3: { title: 'Schulhausfassade Bern West', summary: 'Fassade mit Dreifach-Isolierglas, Ug 0,5. Lukas schickt nächste Woche die Pläne. Zwei weitere Anbieter im Rennen.' },
  m4: { title: 'Balkongeländer', summary: 'Verbundsicherheitsglas VSG 2x8 mm für 40 Geländer. Nicole braucht Angaben zur Kantenbearbeitung.' },
  m5: { title: 'Glaswände Wellnessbereich', summary: 'Michael möchte satinierte Glaswände mit Logo-Gravur. Begehung geplant.' },
  m6: { title: 'Sanierungsprogramm 2027', summary: 'Fensterersatz für 64 Wohnungen in drei Etappen. Martin lädt im Frühling zur Ausschreibung ein.' },
  m7: { title: 'Muster Küchenrückwände', summary: 'RAL-Farbmuster gezeigt. Sabrina gefallen Anthrazit und Salbeigrün. Bestellt 3 Küchen pro Monat.' },
  m8: { title: 'Reklamation rahmenlose Dusche', summary: 'Eine Glasscheibe mit abgeplatzter Kante geliefert. Ersatz innert einer Woche versprochen. Corinne sonst zufrieden.' },
  m9: { title: 'Büro-Trennwände', summary: 'Glastrennwände für ein Büro mit 600 m² in Bern. Daniel und Laura brauchen eine Offerte für Akustikglas.' },
  m10: { title: 'Structural-Glazing-Projekt', summary: 'Heissgelagertes ESG erforderlich. Andrea schickt die Statik.' },

  t1: { title: 'Offerte für Duschwände senden' },
  t2: { title: 'Muster in matt mitbringen' },
  t3: { title: 'Lieferfenster Zollikofen prüfen' },
  t4: { title: 'Fassadenofferte Ug 0,5 vorbereiten' },
  t5: { title: 'Spezifikation Kantenbearbeitung senden' },
  t6: { title: 'Begehung Wellnessbereich' },
  t7: { title: 'Beschädigte Duschwand ersetzen' },
  t8: { title: 'Offerte Akustikglas' },
  t9: { title: 'RAL-Farbkarte senden' },
  t10: { title: 'Ausschreibung nachfassen' },
  t11: { title: 'Jahresrabatt bestätigen' },
  t12: { title: 'Neues Chalet-Projekt besuchen' },

  k1: {
    title: 'Rahmenlose Duschwand', product: 'ESG 8 mm Duschwand',
    summary: 'Wandmontierte rahmenlose Glaswand mit Klemmen und Stabilisationsstange.',
    tags: ['Dusche', 'ESG', 'Bad'],
    steps: [
      { text: 'Prüfen, ob die Wand lotrecht und gefliest ist. Klemmpositionen 200 mm von Ober- und Unterkante anzeichnen.', image: 'Klemmpositionen anzeichnen' },
      { text: '6-mm-Löcher bohren, Dübel setzen und die Wandklemmen befestigen. Nicht zu fest anziehen.', image: 'Wandklemmen befestigen' },
      { text: 'Glas auf zwei 6-mm-Klötze stellen. Mit den Gummidichtungen in die Klemmen einsetzen.', image: 'Glas einsetzen' },
      { text: 'Stabilisationsstange auf 2000 mm Höhe montieren. Waage prüfen und alle Schrauben anziehen.', image: 'Stabilisationsstange' },
      { text: 'Klötze entfernen und die Unterkante mit transparentem Silikon abdichten. 24 h nicht benutzen.', image: 'Unterkante abdichten' },
    ],
  },
  k2: {
    title: 'Glas-Balkongeländer', product: 'VSG 2x8 mm Geländer',
    summary: 'Geländer im Bodenprofil mit Verbundsicherheitsglas.',
    tags: ['Geländer', 'VSG', 'aussen'],
    steps: [
      { text: 'Aluminium-Bodenprofil alle 300 mm verankern. Dübeltyp gemäss Lasttabelle wählen.', image: 'Bodenprofil verankern' },
      { text: 'Glas mit Saughebern einsetzen. Mindestens zwei Personen.', image: 'Glas einsetzen' },
      { text: 'Glas mit den Klemmeinsätzen verkeilen. Mit dem Justierschlüssel senkrecht ausrichten.', image: 'Klemmen und ausrichten' },
      { text: 'Handlaufkappe und Abdeckleisten montieren.', image: 'Handlaufkappe' },
    ],
  },
  k3: {
    title: 'Küchenrückwand', product: 'Farbige ESG 6 mm Rückwand',
    summary: 'Geklebte Rückwand mit Ausschnitten für Steckdosen.',
    tags: ['Küche', 'ESG', 'Kleben'],
    steps: [
      { text: 'Wand reinigen. Sie muss trocken, eben und staubfrei sein.', image: 'Wand reinigen' },
      { text: 'Spiegelkleber in senkrechten Streifen im Abstand von 10 cm auftragen. Nie essigvernetzendes Silikon verwenden.', image: 'Kleber auftragen' },
      { text: 'Glas andrücken, Ausschnitte auf die Steckdosen ausrichten. 24 h abstützen.', image: 'Glas andrücken' },
    ],
  },
  k4: {
    title: 'Glastrennwand Büro', product: 'VSG Akustik-Trennwand 10 mm',
    summary: 'Raumhohe Trennwand in U-Profilen.',
    tags: ['Büro', 'Akustik', 'Trennwand'],
    steps: [
      { text: 'Decken- und Boden-U-Profile in einer Flucht befestigen. Laser verwenden.', image: 'U-Profile befestigen' },
      { text: 'Glas zuerst oben einsetzen, dann ins Bodenprofil absenken.', image: 'Glas einsetzen' },
      { text: 'Fugen beidseitig mit der Akustikdichtung füllen.', image: 'Akustikdichtung' },
      { text: 'Gläser mit transparenten H-Profilen oder Stossfugenband verbinden.', image: 'Gläser verbinden' },
    ],
  },
  k5: {
    title: 'ESG vs. VSG', product: 'Sicherheitsglas',
    summary: 'ESG (vorgespannt) zerfällt in kleine Krümel. VSG (Verbund) bleibt dank PVB-Folie ganz. Geländer und Überkopfverglasungen brauchen VSG; Duschen meist ESG.',
    tags: ['ESG', 'VSG', 'Grundlagen'],
  },
  k6: {
    title: 'Kondensat zwischen den Scheiben', product: 'Isolierglas',
    summary: 'Kondensat im Isolierglas bedeutet, dass der Randverbund versagt hat. Das Glas muss ersetzt werden, eine Reparatur ist nicht möglich. Garantiedatum auf dem Abstandhalter prüfen.',
    tags: ['Isolierglas', 'Garantie'],
  },
  k7: {
    title: 'Lieferzeiten', product: 'Alle Produkte',
    summary: 'Floatglas nach Mass: 3 Tage. ESG: 7 Tage. VSG: 10 Tage. Farbiges ESG: 12 Tage. Heat-Soak-Test plus 2 Tage.',
    tags: ['Lieferung', 'Lieferzeit'],
  },

  e1: {
    subject: 'Anfrage Offerte Duschtrennwände',
    body: 'Guten Tag\n\nFür ein Mehrfamilienhaus in Spiez benötigen wir eine Offerte für:\n\n- 6 Stk. Duschwände ESG 8 mm klar, 900 x 2000 mm\n- 6 Stk. Pendeltüren ESG 8 mm klar, 800 x 2000 mm\n- 6 Stk. Stabilisationsstangen, chrom\n\nLiefertermin wäre KW 49. Bitte um Rückmeldung bis Ende Woche.\n\nFreundliche Grüsse\nPeter Zbinden\nSanitär Zbinden AG',
  },
  e2: {
    subject: 'Offertanfrage: Akustik-Glastrennwände',
    body: 'Guten Tag\n\nwie mit Daniel besprochen, bitte senden Sie uns eine Offerte für das Büroprojekt in Bern:\n\n- 14 Gläser VSG Akustik 10 mm, 1200 x 2800 mm\n- 2 Glastüren ESG 10 mm, 1000 x 2200 mm, mit Griffen\n\nLieferung auf die Baustelle im Januar.\n\nFreundliche Grüsse\nLaura Baumann',
  },
  e3: {
    subject: 'Küchenrückwände – 3 Küchen',
    body: 'Hoi zäme\n\nIch bräuchte eine Offerte für drei Küchenrückwände ESG 6 mm farbig:\n\n1. Anthrazit RAL 7016, 3200 x 650 mm, 2 Steckdosenausschnitte\n2. Salbeigrün, 2400 x 600 mm\n3. Weiss RAL 9010, 2800 x 650 mm, 3 Steckdosenausschnitte\n\nMerci und liebe Grüsse\nSabrina',
  },
  e4: {
    subject: 'Termin Begehung',
    body: 'Guten Tag\n\nKönnen wir die Begehung der Siedlung auf den 12. verschieben? Der Hauswart ist am ursprünglichen Termin nicht da.\n\nGruss\nMartin Aebi',
  },
  e5: {
    subject: 'Glaswände Wellnessbereich',
    body: 'Sehr geehrte Damen und Herren\n\nWir planen den Umbau unseres Wellnessbereichs und bitten um eine Offerte:\n\n- 5 Glaswände ESG 10 mm satiniert, 1500 x 2400 mm, mit Logo-Gravur\n- 1 Ganzglastür ESG 10 mm satiniert, 900 x 2100 mm\n\nMit freundlichen Grüssen\nMichael Schmid\nTechnischer Leiter',
  },
  e6: {
    subject: 'Re: Ersatz Glas',
    body: 'Danke für die schnelle Antwort. Der Ersatz kann direkt auf die Baustelle in Lyss geliefert werden.\n\nCorinne',
  },
  e7: {
    subject: 'Messe Swissbau 2027 – Save the date',
    body: 'Die Swissbau findet vom 19. bis 22. Januar 2027 in Basel statt.',
  },
}

/** English (base) and German text of every demo record, for switching the language later. */
export function seedTexts(): Record<string, { en: SeedText; de: SeedText }> {
  const base: Record<string, Record<string, unknown>> = Object.fromEntries(
    [...companies, ...people, ...meetings, ...tasks, ...knowledge, ...emails].map((r) => [r.id, r as unknown as Record<string, unknown>]),
  )
  return Object.fromEntries(
    Object.entries(DE).map(([id, de]) => [id, { en: Object.fromEntries(Object.keys(de).map((k) => [k, base[id][k] as SeedText[string]])), de }]),
  )
}

const local = <T extends { id: string }>(r: T, lang: Lang): T => (lang === 'de' && DE[r.id] ? { ...r, ...DE[r.id] } : r)

export function seed(lang: Lang = getSettings().lang): DB {
  const created = new Date().toISOString()
  return {
    companies: companies.map((c) => ({ ...local(c, lang), createdAt: created })),
    people: people.map((p) => ({ notes: '', ...local(p, lang), createdAt: created })),
    meetings: meetings.map((m) => ({ ...local(m, lang), createdAt: created })),
    tasks: tasks.map((t) => ({ ...local(t, lang), createdAt: created })),
    knowledge: knowledge.map((k) => ({ ...local(k, lang), createdAt: created })),
    emails: emails.map((e) => local(e, lang)),
  }
}
