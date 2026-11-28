import {createHash} from 'node:crypto'
import {activeHead, extractActiveDescription, readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const CAREERS = 'https://www.aaravsolutions.com/careers/'
const COMPANY = 'Aarav Solutions'
const fail = reason => { throw Object.assign(Error(`Aarav current structured ${reason}`), {
  softFailure: true, abortRetries: true, failureKind: 'parser_or_contract_error',
}) }
const requireValue = (condition, reason) => { if (!condition) fail(reason) }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const keysWithin = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key))
const equal = (first, second) => JSON.stringify(first) === JSON.stringify(second)
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
const countries = new Set(['United States', 'United Kingdom', 'Canada', 'Singapore', 'India'])
const schemaKeys = ['@context', '@type', 'title', 'description', 'datePosted', 'totalJobOpenings',
  'occupationalCategory', 'hiringOrganization', 'url', 'jobLocationType',
  'applicantLocationRequirements', 'validThrough', 'employmentType']
const recordsFrom = value => Array.isArray(value) ? value.flatMap(recordsFrom)
  : object(value) && value['@type'] === 'JobPosting' ? [value]
    : object(value) && Array.isArray(value['@graph']) ? value['@graph'].flatMap(recordsFrom) : []

// This reads source data. CSS, executable clients, application controls and
// employer-wide recruitment scope remain unqualified on every returned row.
export const readCurrentStructuredPage = page => {
  requireValue(page?.status === 200 && page.url === CAREERS && typeof page.html === 'string'
    && Buffer.byteLength(page.html) <= 3000000, 'page response identity changed')
  const html = page.html, document = readNativeDocument(html, {sourceRanges: true, excludeObjectFallback: false})
  requireValue(equal(activeHead(html).titles, ['Careers - Aarav Solutions']), 'page title changed')
  const sections = document.nodes(node => node.tag === 'section' && node.attrs.id === 'open-roles')
  requireValue(sections.length === 1, 'role section changed')
  const cards = document.nodes(node => node.tag === 'article' && document.hasClass(node, 'ac-role'))
  const sectionCards = document.nodes(node => node.tag === 'article' && document.hasClass(node, 'ac-role'), sections[0])
  requireValue(cards.length > 0 && cards.length <= 100 && equal(cards, sectionCards), 'native card inventory changed')
  const schemas = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json' && !node.attrs.src)
    .flatMap(node => {
      try { return recordsFrom(JSON.parse(node.raw)) } catch { fail('native schema is not complete JSON') }
    })
  requireValue(schemas.length === cards.length, 'schema/card membership changed')
  const byId = new Map()
  for (const card of cards) {
    requireValue(typeof card.attrs.id === 'string' && /^[a-z0-9-]+$/.test(card.attrs.id)
      && !byId.has(card.attrs.id) && Number.isInteger(card.sourceEnd)
      && keysWithin(card.attrs, ['id', 'class', 'data-category', 'data-exp', 'data-search']), 'native card identity or geography changed')
    byId.set(card.attrs.id, card)
  }
  const seen = new Set(), records = []
  for (const schema of schemas) {
    requireValue(keysWithin(schema, schemaKeys)
      && ['https://schema.org', 'https://schema.org/'].includes(schema['@context'])
      && schema['@type'] === 'JobPosting' && typeof schema.title === 'string' && schema.title.trim()
      && typeof schema.description === 'string' && extractActiveDescription(schema.description)
      && date(schema.datePosted) && (schema.validThrough === undefined || date(schema.validThrough))
      && schema.jobLocationType === 'TELECOMMUTE' && schema.employmentType === 'FULL_TIME', 'native criteria or geography schema changed')
    const organization = schema.hiringOrganization
    requireValue(keysWithin(organization, ['@type', 'name', 'sameAs']) && organization['@type'] === 'Organization'
      && organization.name === COMPANY && ['https://www.aaravsolutions.com', 'https://www.aaravsolutions.com/'].includes(organization.sameAs),
    'native employer identity changed')
    requireValue(schema.validThrough === undefined || schema.validThrough >= schema.datePosted, 'native closing date precedes posting')
    let url
    try { url = new URL(schema.url) } catch { fail('native role URL changed') }
    const id = url.hash.slice(1)
    requireValue(schema.url === url.href && url.href === CAREERS + '#' + id && /^[a-z0-9-]+$/.test(id) && byId.has(id) && !seen.has(id),
      'native role identity changed')
    seen.add(id)
    const eligible = schema.applicantLocationRequirements
    requireValue(Array.isArray(eligible) && eligible.length > 0 && eligible.length <= countries.size
      && eligible.every(country => keysWithin(country, ['@type', 'name']) && country['@type'] === 'Country' && countries.has(country.name))
      && new Set(eligible.map(country => country.name)).size === eligible.length, 'native applicant geography changed')
    requireValue(schema.totalJobOpenings === undefined || Number.isSafeInteger(schema.totalJobOpenings) && schema.totalJobOpenings > 0,
      'native openings type changed')
    requireValue(schema.occupationalCategory === undefined || typeof schema.occupationalCategory === 'string' && schema.occupationalCategory.trim(),
      'native practice type changed')
    const card = byId.get(id), titles = document.nodes(node => node.tag === 'h3', card)
    requireValue(titles.length === 1 && document.text(titles[0]) === schema.title, 'native title contradiction')
    requireValue(card.attrs['data-category'] === undefined || card.attrs['data-category'] === schema.occupationalCategory,
      'native practice contradiction')
    requireValue(!document.nodes(node => ['script', 'iframe', 'object', 'embed', 'form'].includes(node.tag), card).length,
      'unreviewed embedded role criteria')
    const boxes = document.nodes(node => node.tag === 'dl', card), metadata = {}
    requireValue(boxes.length <= 1, 'native metadata boxes changed')
    if (boxes.length) {
      const fields = boxes[0].children.filter(node => typeof node !== 'string')
      requireValue(fields.length > 0 && fields.length % 2 === 0, 'native metadata shape changed')
      for (let index = 0; index < fields.length; index += 2) {
        const key = document.text(fields[index]), value = document.text(fields[index + 1])
        requireValue(fields[index].tag === 'dt' && fields[index + 1].tag === 'dd'
          && ['Experience', 'Openings', 'Availability', 'Salary', 'Location'].includes(key)
          && !Object.hasOwn(metadata, key) && value, 'native metadata criterion changed')
        metadata[key] = value
      }
      requireValue(metadata.Location === 'Remote', 'native workplace contradiction')
      if (metadata.Openings !== undefined) requireValue(String(schema.totalJobOpenings) === metadata.Openings, 'native opening count contradiction')
    }
    const summaries = document.nodes(node => node.tag === 'ul' && document.hasClass(node, 'ac-meta'), card)
    requireValue(summaries.length <= 1, 'native role summaries changed')
    if (summaries.length && boxes.length) {
      const values = document.nodes(node => node.tag === 'li', summaries[0]).map(document.text)
      requireValue(equal(values, [schema.occupationalCategory, metadata.Experience, metadata.Location,
        `${schema.totalJobOpenings} ${schema.totalJobOpenings === 1 ? 'opening' : 'openings'}`]), 'native summary criteria contradiction')
    }
    const skillLists = document.nodes(node => node.tag === 'ul' && document.hasClass(node, 'ac-skills'), card)
    requireValue(skillLists.length <= 1, 'native skill sections changed')
    if (skillLists.length) {
      const authored = document.nodes(node => node.tag === 'li', skillLists[0]).map(document.text)
      const source = readNativeDocument(schema.description)
      const structured = source.nodes(node => node.tag === 'li').map(source.text)
      requireValue(authored.length > 0 && equal(authored, structured)
        && extractActiveDescription(schema.description) === 'Mandatory skill-sets: ' + authored.join(' '), 'native skill criteria contradiction')
    }
    const cardHtml = html.slice(card.sourceStart, card.sourceEnd), cardText = document.text(card)
    const criterionText = [extractActiveDescription(schema.description), cardText,
      'Applicant locations: ' + eligible.map(country => country.name).join('; '),
      schema.validThrough === undefined ? null : 'Valid through: ' + schema.validThrough].filter(Boolean).join('\n\n')
    records.push({id, schema: structuredClone(schema), cardHtml, cardText, metadata,
      criterionText, indiaEligible: eligible.some(country => country.name === 'India'),
      nativeCriteriaTextComplete: boxes.length === 1 && Object.keys(metadata).length === 5 && skillLists.length === 1
        && schema.totalJobOpenings !== undefined && schema.validThrough !== undefined && schema.occupationalCategory !== undefined})
  }
  return {records, pageSHA256: createHash('sha256').update(html).digest('hex')}
}

export const structuredCriteriaState = snapshot => JSON.stringify([...snapshot.records]
  .sort((first, second) => first.id.localeCompare(second.id)).map(record => ({schema: record.schema, cardHtml: record.cardHtml})))

export const enrichCurrentStructuredJobs = (jobs, snapshot) => jobs.map(job => {
  const record = snapshot.records.find(item => item.schema.url === job.sourceUrl)
  requireValue(record?.indiaEligible === true, 'normalized job is not a native India candidate')
  return {...job, city: null, closingDate: record.schema.validThrough ?? null,
    jobDescription: record.criterionText, sourceDescription: record.criterionText,
    sourceNativeRecord: structuredClone(record), nativeCriteriaTextComplete: record.nativeCriteriaTextComplete,
    sourceDetailComplete: false, sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false,
    sourceAvailabilityQualified: false, applicationPublicContextValidated: false,
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    sourceDetailFailureKind: 'current-native-criteria-data-rendering-application-and-company-scope-unqualified'}
})
