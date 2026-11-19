import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createCorporateFeedReader } from '../../scraper-support/utils/currentCorporateFeed20261118.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import CYPHEROX_CATALOG from './catalog.js'

const PROFILE = JSON.parse(readFileSync(new URL('./currentProfile20261119.json', import.meta.url), 'utf8'))
const CAREERS_URL = 'https://www.cypherox.com/career'
const SOURCE = 'cypherox'
const hash = value => createHash('sha256').update(value).digest('hex')
const need = (value, reason) => { if (!value) throw Error('Cypherox current native ' + reason) }
const program = node => !node.attrs.type || /^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type)
const INDIA_CITIES = new Map([['Rajkot', 'Gujarat'], ['Ahmedabad', 'Gujarat']])

function readModel(html) {
  const document = readNativeDocument(html), { nodes, text, hasClass } = document
  const one = (predicate, label, parent) => {
    const found = nodes(predicate, parent)
    need(found.length === 1, label + ' is missing, duplicate or inert')
    return found[0]
  }
  need(JSON.stringify(activeHead(html).titles) === JSON.stringify([PROFILE.title]), 'publisher title changed')
  need(one(node => node.tag === 'link' && node.attrs.rel === 'canonical', 'publisher canonical').attrs.href === CAREERS_URL, 'publisher URL changed')
  const organizations = []
  const containsJobPosting = value => {
    if (!value || typeof value !== 'object') return false
    if ([value['@type']].flat().includes('JobPosting')) return true
    return Object.values(value).some(containsJobPosting)
  }
  for (const node of nodes(item => item.tag === 'script' && item.attrs.type === 'application/ld+json')) {
    const payload = JSON.parse(node.raw)
    need(!containsJobPosting(payload), 'alternate JobPosting metadata requires review')
    organizations.push(...(Array.isArray(payload?.['@graph']) ? payload['@graph'] : [payload]).filter(item => item?.['@type'] === 'Organization'))
  }
  need(organizations.length === 1 && organizations[0].name === 'Cypherox Technologies'
    && organizations[0].legalName === 'Cypherox Technologies Pvt. Ltd.'
    && organizations[0].url === 'https://www.cypherox.com/', 'publisher employer changed')
  const declarations = nodes(node => node.tag === 'script' && program(node)).map(node => node.attrs.src
    ? { src: new URL(node.attrs.src, CAREERS_URL).href } : { inlineSHA256: hash(node.raw || '') })
  need(JSON.stringify(declarations) === JSON.stringify(PROFILE.declarations), 'activation client declarations changed')
  const eventHandlers = nodes(() => true).flatMap(node => Object.entries(node.attrs)
    .filter(([name]) => /^on/i.test(name)).map(([name, value]) => ({ tag: node.tag, id: node.attrs.id || null, name, value })))
  need(JSON.stringify(eventHandlers) === JSON.stringify(PROFILE.eventHandlers), 'activation event handlers changed')
  // Unknown authored presentation cannot silently hide a stable criteria tree.
  // The lexical style hold is deliberately conservative, including inert copies.
  const inlineStyles = [...html.matchAll(/<style(?=[\t\n\f\r />])[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(match => hash(match[1]))
  const stylesheetDeclarations = nodes(node => node.tag === 'link' && node.attrs.rel === 'stylesheet').map(node => node.attrs)
  need(JSON.stringify(inlineStyles) === JSON.stringify(PROFILE.inlineStyles)
    && JSON.stringify(stylesheetDeclarations) === JSON.stringify(PROFILE.stylesheetDeclarations), 'authored presentation stylesheet declarations changed')
  const form = one(node => node.tag === 'form' && node.attrs.id === 'career-form', 'application form')
  const controls = nodes(node => ['input', 'textarea', 'button', 'select'].includes(node.tag), form)
  const controlModel = controls.map(node => ({ tag: node.tag, type: node.attrs.type || null,
    id: node.attrs.id || null, name: node.attrs.name || null }))
  need(JSON.stringify(controlModel) === JSON.stringify(PROFILE.formControls)
    && controls.every(node => !Object.hasOwn(node.attrs, 'disabled') && !Object.hasOwn(node.attrs, 'readonly')
      && node.attrs['aria-disabled']?.toLowerCase() !== 'true')
    && !nodes(node => node.tag === 'fieldset' && Object.hasOwn(node.attrs, 'disabled'), form).length,
  'application candidate controls are missing, disabled or readonly')
  const roleInput = one(node => node.tag === 'input' && node.attrs.id === 'caeer-selected-post', 'application role control', form)
  const locationInput = one(node => node.tag === 'input' && node.attrs.id === 'career-location-post', 'application location control', form)
  need(!Object.hasOwn(form.attrs, 'action') && !Object.hasOwn(form.attrs, 'method')
    && roleInput.attrs.type === 'text' && locationInput.attrs.type === 'hidden'
    && roleInput.attrs.name === 'apply_for_role' && locationInput.attrs.name === 'career_location_post'
    && !Object.hasOwn(roleInput.attrs, 'disabled') && !Object.hasOwn(locationInput.attrs, 'disabled'), 'application role/location binding changed')
  const container = one(node => hasClass(node, 'career-area-block'), 'role container')
  const cards = nodes(node => hasClass(node, 'career-area-block-wrap'), container)
  need(cards.length > 0 && cards.length <= 100, 'role inventory is missing or unbounded')
  const seen = new Set()
  const records = cards.map(card => {
    const title = text(one(node => hasClass(node, 'at-title') && hasClass(node, 'card-title'), 'role title', card))
    const location = text(one(node => hasClass(node, 'career-location'), 'role location', card))
    need(INDIA_CITIES.has(location), 'location scope is unqualified: ' + location)
    const control = one(node => node.tag === 'a' && hasClass(node, 'career-form-btn'), 'role application control', card)
    need(control.attrs.href === 'javascript:void(0)' && control.attrs['aria-label'] === 'Apply now'
      && text(control) === 'Apply Now' && !Object.hasOwn(control.attrs, 'disabled')
      && control.attrs['aria-disabled'] !== 'true', 'application control changed')
    const info = one(node => hasClass(node, 'other-info'), 'role metadata', card)
    const fields = nodes(node => node.tag === 'p', info).map(text)
    const experience = fields.filter(value => /^Experience:\s*\S/.test(value))
    const openings = fields.filter(value => /^No\. of Openings:\s*\d+$/.test(value))
    need(title && experience.length === 1 && openings.length === 1 && Number(openings[0].split(':')[1]) > 0, 'role metadata is incomplete')
    const criteria = one(node => hasClass(node, 'at-tab') && hasClass(node, 'card-text'), 'full criteria', card)
    const headings = nodes(node => /^h[2-5]$/.test(node.tag), criteria).map(text)
    const description = text(criteria)
    const items = nodes(node => node.tag === 'li', criteria).map(text).filter(value => value.length > 25)
    need(description.length >= 200 && items.length >= 3
      && headings.some(value => /Responsibilities/.test(value))
      && headings.some(value => /Skills|Qualifications|Requirements/.test(value))
      && !/\b(?:full (?:job )?(?:description|criteria) (?:on request|available upon)|coming soon|description to follow)\b/i.test(description), 'full criteria are incomplete')
    need(!/\b(?:this (?:position|role|job) is (?:closed|filled)|no longer accepting applications|applications (?:are )?closed)\b/i.test(description), 'role is explicitly closed')
    const employerKey = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')
    const employerNames = new Set(organizations.flatMap(item => [item.name, item.legalName]).map(employerKey))
    for (const block of nodes(node => node.tag === 'p' || node.tag === 'li', criteria).map(text)) {
      for (const match of block.matchAll(/\b(?:work(?:place)?\s+country|job\s+country|country)\s*:\s*([^.;]+)/gi))
        need(/^(?:India|IN)$/i.test(match[1].trim()), 'role country contradicts its native location')
      for (const match of block.matchAll(/\b(?:employer|hiring\s+(?:company|organization))\s*:\s*([^;]+)/gi))
        need(employerNames.has(employerKey(match[1])), 'role employer contradicts its publisher')
    }
    const identity = JSON.stringify([title, location])
    need(!seen.has(identity), 'duplicate native role identity')
    seen.add(identity)
    return { title, location, experienceRequired: experience[0].replace(/^Experience:\s*/, ''),
      nativeOpenings: Number(openings[0].split(':')[1]), description, criteriaItems: items,
      // The publisher has no posting ID. Keep this derived key distinct from a native requisition.
      derivedJobId: 'cypherox-' + hash(identity).slice(0, 24) }
  })
  return { records, declarations, organizations }
}

export async function runCurrentCypheroxCards(options = {}) {
  options.signal?.throwIfAborted()
  const reader = createCorporateFeedReader(SOURCE, { ...options,
    ...(options.fetchPage || options.fetchText ? { fetchPage: options.fetchPage || options.fetchText } : {}) })
  const retainedResponses = [], audit = { source: SOURCE, retainedResponses, sourceScopeComplete: false,
    companyGlobalTotal: null, companyIndiaTotal: null, lifecycleCleanupAllowed: false,
    browserEquivalenceComplete: false, applicationSubmitted: false }
  const read = async url => {
    const page = await reader.readPage(url)
    need(page.url === url, 'response URL identity changed')
    retainedResponses.push({ url, html: page.html, sha256: page.bodySHA256 })
    return page.html
  }
  const readClient = async () => {
    const client = await read(PROFILE.nativeClient.url)
    need(Buffer.byteLength(client) === PROFILE.nativeClient.bytes && hash(client) === PROFILE.nativeClient.sha256, 'whole reviewed application client changed')
    for (const stylesheet of PROFILE.stylesheets) {
      const css = await read(stylesheet.url)
      need(Buffer.byteLength(css) === stylesheet.bytes && hash(css) === stylesheet.sha256, 'whole authored presentation stylesheet changed')
    }
  }
  try {
    const opening = readModel(await read(CAREERS_URL))
    audit.nativeOpeningRecords = opening.records
    await readClient()
    const closing = readModel(await read(CAREERS_URL))
    audit.nativeClosingRecords = closing.records
    await readClient()
    need(JSON.stringify(opening) === JSON.stringify(closing), 'closing inventory or full criteria changed')
    audit.closingMatches = true
    const now = options.now || (() => new Date().toISOString())
    const jobs = opening.records.map(row => ({ title: row.title, company: CYPHEROX_CATALOG.companyName, department: null,
      jobId: row.derivedJobId, requisitionId: null, sourceJobIdType: 'derived-native-title-location',
      location: row.location + ', Gujarat, India', city: row.location, state: INDIA_CITIES.get(row.location), country: 'India',
      sourceUrl: CAREERS_URL, applyUrl: CAREERS_URL, link: CAREERS_URL, source: SOURCE,
      sourceNativeApplicationTitle: row.title, sourceNativeApplicationLocation: row.location,
      employmentType: null, experienceRequired: row.experienceRequired, jobDescription: row.description,
      requiredSkills: row.criteriaItems, minimumQualification: null, preferredQualification: null,
      postingDate: null, closingDate: null, scrapedAt: now(),
      companyCareerPage: CAREERS_URL, companyDomain: 'cypherox.com', atsPlatform: 'official-company-careers',
      sourceDetailComplete: true, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    }))
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows',
      observedRecordCount: opening.records.length, observedVacancyCount: opening.records.length,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    audit.receipts = reader.receipts
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: audit })
    return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS_URL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: reader.receipts.length,
      reportedTotal: opening.records.length, indiaFacetCount: null, verifiedAt: now(),
      reason: 'current-native-cards-full-criteria-role-bound-form-and-closing-reconciled;company-wide-channel-coverage-unverified' })
  } catch (error) {
    options.signal?.throwIfAborted()
    Object.defineProperty(error, 'nativeCollectionEvidence', { configurable: true, value: { ...audit, receipts: reader.receipts } })
    throw error
  }
}
