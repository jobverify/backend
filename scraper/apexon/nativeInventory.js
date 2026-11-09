import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'

const countries = new Map([['india', 'India'], ['us', 'United States'], ['canada', 'Canada'],
  ['united kingdom', 'United Kingdom'], ['mexico', 'Mexico']])

export function readNativeTable(html, extractCards) {
  const doc = document(html), reasons = new Set()
  const tables = doc.nodes(node => doc.hasClass(node, 'LocationsearchTable'))
  if (tables.length !== 1) throw new Error('Apexon native jobs table identity changed')
  const rows = doc.nodes(node => doc.hasClass(node, 'table_row'), tables[0])
  const locationCountries = new Map()
  for (const node of doc.nodes(node => node.tag === 'li' && node.attrs['data-country'])) {
    const location = doc.text(node), country = countries.get(node.attrs['data-country'].toLowerCase())
    if (!country || (locationCountries.has(location) && locationCountries.get(location) !== country)) reasons.add('native-location-country-unresolved')
    else locationCountries.set(location, country)
  }
  const listings = [], identities = new Map()
  for (const row of rows) {
    const cards = extractCards(doc.outer(row), { allLocations: true })
    if (cards.length !== 1) { reasons.add('native-table-row-unparsed'); continue }
    const card = cards[0], url = new URL(card.sourceUrl)
    if (url.origin !== 'https://www.apexon.com' || url.pathname !== '/career-job-detail/'
      || !/^\d+$/.test(url.searchParams.get('id') || '') || url.searchParams.get('jobid') !== card.requisitionId
      || [...url.searchParams].length !== 2) throw new Error('Apexon native role URL identity changed')
    if (identities.has(card.requisitionId)) reasons.add('duplicate-native-requisition')
    identities.set(card.requisitionId, JSON.stringify(card))
    const nativeCountry = locationCountries.get(card.location)
    if (!nativeCountry && !/\bIndia\b/i.test(card.location)) reasons.add('native-location-country-unresolved')
    if (/\bIndia\b/i.test(card.location)) {
      if (nativeCountry && nativeCountry !== 'India') throw new Error('Apexon native India country disagreement')
      listings.push(card)
    } else if (nativeCountry === 'India') reasons.add('native-India-location-disagreement')
  }
  if (!rows.length || identities.size !== rows.length) reasons.add('native-table-count-unreconciled')
  if (doc.nodes(node => node.tag === 'a' && (node.attrs.rel === 'next' || doc.hasClass(node, 'next-page'))).length) reasons.add('native-pagination-unresolved')
  return { listings, identities, total: rows.length, complete: reasons.size === 0, reasons }
}

export function readNativeDetailIdentity(html) {
  const doc = document(html)
  const refs = doc.nodes(node => node.tag === 'p' && doc.hasClass(node, 'job-code-text'))
  const requisitionId = refs.length === 1 ? doc.text(refs[0]).match(/^Job Reference No#:\s*(\d+)$/)?.[1] : null
  const contents = doc.nodes(node => doc.hasClass(node, 'jobcontent'))
  const content = contents.length === 1 ? contents[0] : null
  const blocks = content?.children.filter(node => typeof node !== 'string' && !node.inactive) || []
  const labels = blocks.flatMap((node, index) => /^Job Location\s*:$/i.test(doc.text(node)) ? [index] : [])
  const location = labels.length === 1 ? doc.text(blocks[labels[0] + 1]) : null
  return { requisitionId, location }
}

export function readNativeRole(html) {
  const doc = readNativeDocument(html)
  const titles = doc.nodes(node => node.tag === 'h1' && doc.hasClass(node, 'jobtitle'))
  const refs = doc.nodes(node => node.tag === 'p' && doc.hasClass(node, 'job-code-text'))
  const contents = doc.nodes(node => doc.hasClass(node, 'jobcontent'))
  const applications = doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'print')
    && doc.text(node) === 'Apply')
  if (titles.length !== 1 || refs.length !== 1 || contents.length !== 1 || applications.length !== 1) {
    throw new Error('Apexon native role has missing or ambiguous active identity')
  }
  const content = contents[0]
  const blocks = content.children.filter(node => typeof node !== 'string' && !node.inert)
  const labels = blocks.flatMap((node, index) => /^Job Location\s*:$/i.test(doc.text(node)) ? [index] : [])
  const location = labels.length === 1 ? doc.text(blocks[labels[0] + 1]) : null
  const render = node => {
    if (typeof node === 'string') return decodeNativeEntities(node)
    if (node.inert || ['script', 'style'].includes(node.tag)) return ''
    if (node.tag === 'br') return '\n'
    const body = node.children.map(render).join('')
    return (node.tag === 'li' ? '\n- ' : '') + body
      + (/^(?:p|div|li|ul|ol|h[1-6])$/.test(node.tag) ? '\n' : '')
  }
  const description = render(content).split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
  const descendants = node => node.inert ? [] : [node,
    ...node.children.filter(child => typeof child !== 'string').flatMap(descendants)]
  const employerPrefixes = [
    'Apexon is a digital-first technology services firm specializing in accelerating business transformation',
    'Apexon is an AI-first technology services firm that engineers intelligent enterprises.',
  ]
  const employers = blocks.filter(node => node.tag === 'p').map(doc.text)
    .filter(text => employerPrefixes.some(prefix => text.toLowerCase().startsWith(prefix.toLowerCase())))
  let application
  try { application = new URL(applications[0].attrs.href) } catch {}
  if (!application || application.origin !== 'https://apexon.talentrecruit.com'
    || !/^\/career-page\/apply\/[^/]+$/.test(application.pathname)
    || application.username || application.password || application.search || application.hash
    || employers.length !== 1 || description.length < 500) {
    throw new Error('Apexon native employer, application or full criteria changed')
  }
  return {
    title: doc.text(titles[0]),
    requisitionId: doc.text(refs[0]).match(/^Job Reference No#:\s*(\d+)$/)?.[1] || null,
    location, description, applyUrl: application.href,
    employerStatement: employers[0],
    requiredSkills: descendants(content).filter(node => node.tag === 'li').map(doc.text).filter(Boolean),
  }
}
