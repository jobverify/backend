import { createHash } from 'node:crypto'
import { activeHead, extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const CAREERS = 'https://coralogix.com/careers/'
const CLIENT = 'https://coralogix.com/assets/pages/careers/page.js?v=0f8f0637'
const DETAIL_CLIENT = 'https://coralogix.com/assets/pages/careers-position/page.js?v=5461ccfb'
const ASTRO_CLIENT = 'https://coralogix.com/_astro/careers-page.tEjVQcR0.js'
const ASTRO_DETAIL_CLIENT = 'https://coralogix.com/_astro/careers-position-page.CqJoTVAg.js'
const CURRENT_SSR_CLIENT = 'https://coralogix.com/_astro/careers-page.Cx6kwXfg.js'
// The reviewed deployments declare the same complete-array Comeet inventory
// and same-ID details=true read. Select only the deployment actually declared
// by the current corporate page, and never use retired assets as a fallback.
const DEPLOYMENTS = new Map([[CLIENT, DETAIL_CLIENT], [ASTRO_CLIENT, ASTRO_DETAIL_CLIENT], [CURRENT_SSR_CLIENT, null]])
const API = 'https://www.comeet.co/careers-api/2.0/company/06.004/positions'
// This public pair is declared by the current first-party executable careers client.
const TOKEN = '604241801E141E1460430200604604'
const LIST = `${API}?token=${TOKEN}`
const SHA = {
  [CLIENT]: '79f85c6ce468f19cf8d5674a32b49af5bd1fe72c8afc22589f929f330c8cb090',
  [DETAIL_CLIENT]: '52c4e12eac8444f00f6dd196614cd21b97fdb83219927b8262cdaadcc9d0c5a9',
  [ASTRO_CLIENT]: 'bdc2cc3e956fd5cd387def8841581cddfc0f10db3d3496d1d93efb2aff71cd72',
  [ASTRO_DETAIL_CLIENT]: 'e47847bd7ffcad14ac1fcea09cd155e04a923abea133b79591d0299584c14bcc',
  [CURRENT_SSR_CLIENT]: 'a79e0c5a7d44a1943a901403d3bd46dd0618f89b69c51b2cc5aaf5d6b54040e6',
}
const hash = value => createHash('sha256').update(value).digest('hex')
const need = (value, why) => { if (!value) throw Error('Coralogix current native: ' + why) }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const one = (rows, label) => { need(rows.length === 1, 'expected one active ' + label); return rows[0] }
const display = new Intl.DisplayNames(['en'], { type: 'region' })
const country = code => typeof code === 'string' && /^[A-Z]{2}$/.test(code)
  && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code) && display.of(code) !== code ? display.of(code) : null
const nativeLocationKeys = new Set(['name', 'country', 'city', 'state', 'postal_code', 'street_name', 'arrival_instructions', 'street_number', 'timezone', 'location_uid', 'is_remote'])
const nativeCountry = row => Object.keys(row.location || {}).some(key => !nativeLocationKeys.has(key))
  || Object.keys(row).some(key => /countr|location|workplace|worksite|address/i.test(key) && !['location', 'workplace_type'].includes(key))
  ? null : country(row.location?.country)
const detailUrl = uid => `${API}/${uid}?token=${TOKEN}&details=true`
const script = (html, url) => {
  const doc = readNativeDocument(html)
  return doc.nodes(node => node.tag === 'script' && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/(?:java|ecma)script)$/.test(node.attrs.type || '')
    && new URL(node.attrs.src || '', CAREERS).href === url)
}
const listing = html => {
  const rows = JSON.parse(html), ids = new Set()
  need(Array.isArray(rows) && rows.length <= 1000, 'unsupported inventory shape or continuation')
  for (const row of rows) {
    need(row && typeof row.uid === 'string' && /^[A-Z\d]{2}\.[A-Z\d]{3}(?:-[A-Z\d]{2}\.[A-Z\d]{3})?$/.test(row.uid)
      && !ids.has(row.uid) && row.company_name === 'Coralogix' && typeof row.name === 'string' && row.name.trim()
      && typeof row.is_internal === 'boolean' && row.location && row.position_url === `${API}/${row.uid}?token=${TOKEN}`,
    'invalid or conflicting native employer/tenant/posting identity')
    const hosted = new URL(row.url_comeet_hosted_page)
    need(hosted.origin === 'https://www.comeet.com' && hosted.pathname.startsWith('/jobs/coralogix/06.004/')
      && hosted.pathname.endsWith('/' + row.uid) && !hosted.search && !hosted.hash, 'native application employer identity changed')
    ids.add(row.uid)
  }
  return rows.filter(row => !row.is_internal)
}
const projection = rows => [...rows].sort((a, b) => a.uid.localeCompare(b.uid))
const visibleAuthoredCriteria = html => {
  // The reviewed native rich text uses only these typography declarations.
  // Unknown styling can conceal a fragment even while the remaining JD is long.
  const typography = style => style.split(';').every(value => !value.trim()
    || /^(?:white-space\s*:\s*pre-wrap|text-align\s*:\s*left)\s*$/i.test(value.trim()))
  const doc = readNativeDocument(html)
  const visible = node => typeof node === 'string' || (!node.inert && !Object.hasOwn(node, 'raw')
    && typography(node.attrs.style || '') && node.children.every(visible))
  return visible(doc.nodes(node => node.tag === 'root')[0])
}
const detail = (html, row) => {
  const raw = JSON.parse(html)
  need(raw.uid === row.uid && raw.name === row.name && raw.company_name === 'Coralogix' && raw.is_internal === false
    && equal(raw.location, row.location) && raw.url_comeet_hosted_page === row.url_comeet_hosted_page
    && raw.url_active_page === row.url_active_page && raw.employment_type === row.employment_type
    && raw.experience_level === row.experience_level && raw.workplace_type === row.workplace_type
    && raw.department === row.department && nativeCountry(raw) === 'India',
  'same-ID native detail identity/title/workplace conflict')
  need(Array.isArray(raw.details) && raw.details.length > 0 && raw.details.length <= 30, 'full native criteria unavailable')
  const sections = raw.details.filter(section => typeof section.value === 'string' && section.value.trim())
  need(sections.length === raw.details.length && sections.some(section => section.name === 'Description')
    && sections.some(section => section.name === 'Requirements') && sections.every(section =>
      typeof section.name === 'string' && extractActiveDescription(section.value)
      && visibleAuthoredCriteria(section.value)),
  'full visible authored description and requirements unavailable')
  const description = sections.map(section => `${section.name}: ${section.value}`).join('\n')
  need(extractActiveDescription(description)?.length >= 250, 'full role criteria unavailable')
  return {
    source: 'coralogix', company: 'Coralogix', jobId: row.uid, requisitionId: row.uid, title: row.name,
    department: row.department, location: row.location.name, city: row.location.city || null,
    state: row.location.state || null, country: 'India', sourceNativeLocation: structuredClone(row.location),
    sourceUrl: row.url_comeet_hosted_page, detailUrl: row.url_comeet_hosted_page,
    applyUrl: row.url_comeet_hosted_page, link: row.url_comeet_hosted_page,
    companyDomain: 'coralogix.com', companyCareerPage: CAREERS, atsPlatform: 'comeet',
    employmentType: row.employment_type, experienceRequired: row.experience_level,
    remoteStatus: row.workplace_type || null, postingDate: null, sourcePostingDateUnavailable: true,
    closingDate: null, jobDescription: description, sourceDescription: description, sourceDetailComplete: true,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    sourceCompanyScope: 'Current first-party-declared Comeet tenant 06.004 public board; company-wide recruitment scope unproved',
  }
}

// The current first-party deployment renders role criteria in the original
// HTML, with no former detail-client declaration. Treat this as published data,
// retain its complete original model, and compare it with the same native UID.
// Neither this static check nor a native API response qualifies rendered/UI or
// application behavior; that uncertainty remains an explicit detail hold.
const currentPublicRole = (html, row) => {
  const doc = readNativeDocument(html, { sourceRanges: true })
  const roleURL = new URL(row.url_active_page); roleURL.search = ''
  const canonical = one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'current public canonical')
  need(canonical.attrs.href === roleURL.href && roleURL.origin === 'https://coralogix.com', 'current public canonical authority changed')
  need(!doc.nodes(node => node.tag === 'base' || node.tag === 'iframe'
    || node.tag === 'meta' && (node.attrs['http-equiv'] || '').toLowerCase() === 'refresh').length, 'current public navigation authority changed')
  const carrier = one(doc.nodes(node => node.tag === 'script' && node.attrs.id === 'job-ld'
    && node.attrs.type === 'application/ld+json' && !node.attrs.src), 'current public JobPosting model')
  const model = JSON.parse(carrier.raw)
  const expectedKeys = ['@context', '@type', '@id', 'title', 'description', 'datePosted', 'employmentType',
    'hiringOrganization', 'identifier', 'jobLocation', 'occupationalCategory', 'directApply', 'url']
  const employment = { 'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME', Contract: 'CONTRACTOR', Internship: 'INTERN', Temporary: 'TEMPORARY' }
  need(equal(Object.keys(model).sort(), expectedKeys.sort()) && model['@context'] === 'https://schema.org'
    && model['@type'] === 'JobPosting' && model['@id'] === roleURL.href + '#job' && model.url === roleURL.href
    && model.title === row.name && model.identifier?.name === 'Coralogix' && model.identifier.value === row.uid
    && model.hiringOrganization?.name === 'Coralogix' && model.hiringOrganization.sameAs === 'https://coralogix.com'
    && equal(Object.keys(model.hiringOrganization).sort(), ['@type', 'logo', 'name', 'sameAs'])
    && model.hiringOrganization['@type'] === 'Organization'
    && equal(Object.keys(model.identifier).sort(), ['@type', 'name', 'value']) && model.identifier['@type'] === 'PropertyValue'
    && model.jobLocation?.['@type'] === 'Place' && model.jobLocation.address?.['@type'] === 'PostalAddress'
    && equal(Object.keys(model.jobLocation).sort(), ['@type', 'address'])
    && equal(Object.keys(model.jobLocation.address).sort(), ['@type', 'addressCountry'])
    && model.jobLocation.address.addressCountry === 'IN' && model.datePosted === row.time_updated
    && model.employmentType === employment[row.employment_type] && model.occupationalCategory === row.department
    && model.directApply === false,
  'current public employer/role/country/model identity changed')
  one(doc.nodes(node => node.tag === 'h1' && doc.text(node) === row.name), 'current public native title')
  const owner = one(doc.nodes(node => (node.attrs.class || '').split(/\s+/).includes('job-body')), 'current public full criteria owner')
  const body = html.slice(owner.sourceStart, owner.sourceEnd)
  const criteriaText = extractActiveDescription(model.description)
  need(criteriaText?.length >= 250 && visibleAuthoredCriteria(body)
    && criteriaText.replace(/\s+/g, ' ').trim() === doc.text(owner).replace(/\s+/g, ' ').trim(),
  'current public complete model/criteria presentation differs')
  need(doc.nodes(node => node.tag === 'a' && node.attrs.href === row.url_comeet_hosted_page).length > 0,
    'current public native application binding changed')
  return { model, criteriaText, originalHtml: html, originalEntitySHA256: hash(html),
    originalEntityBytes: Buffer.byteLength(html), renderedCriteriaQualified: false, applicationQualified: false }
}

export async function runCurrentCoralogix(options = {}) {
  const signal = AbortSignal.any([AbortSignal.timeout(180000), ...(options.signal ? [options.signal] : [])])
  const wait = promise => new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
  const responses = [], failures = [], observed = new Map(), nativeDetailObservations = []
  let currentPublicRoleOpening = null, currentPublicRoleClosing = null
  const read = async url => {
    signal.throwIfAborted()
    const page = await wait(Promise.resolve().then(async () => {
      if (options.fetchPage) return options.fetchPage(url, { signal })
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,application/json,application/javascript' } })
      return { status: response.status, url: response.url, html: await response.text() }
    }))
    signal.throwIfAborted()
    need(page.status === 200 && page.url === url, 'public HTTP/final URL identity changed: ' + url + ' (' + page.status + ')')
    need(typeof page.html === 'string' && Buffer.byteLength(page.html) <= 16000000, 'invalid or oversized public response')
    responses.push({ url, status: page.status, sha256: hash(page.html), bytes: Buffer.byteLength(page.html) })
    return page.html
  }
  const context = async () => {
    const html = await read(CAREERS), doc = readNativeDocument(html)
    need(activeHead(html).titles.includes('Careers at Coralogix: Open Positions | Coralogix')
      && doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === CAREERS).length === 1
      && doc.nodes(node => node.attrs.id === 'positions').length === 1, 'active corporate careers identity changed')
    const client = one([...DEPLOYMENTS.keys()].filter(url => script(html, url).length === 1), 'current listing client')
    need(hash(await read(client)) === SHA[client], 'unreviewed public inventory client contract')
    return client
  }
  const currentClient = await context(), currentDetailClient = DEPLOYMENTS.get(currentClient)
  const currentSSR = currentClient === CURRENT_SSR_CLIENT
  const opening = listing(await read(LIST))
  const representative = opening.find(row => nativeCountry(row) === 'India'
    && (!currentSSR || new URL(row.url_active_page).origin === 'https://coralogix.com'))
  if (currentSSR && opening.some(row => nativeCountry(row) === 'India')) need(representative, 'current public India role authority unavailable')
  if (representative) {
    const roleUrl = new URL(representative.url_active_page)
    // The current first-party link appends only this navigation-context flag.
    // Preserve the original declared URL; no arbitrary query or redirect is accepted.
    need(roleUrl.origin === 'https://coralogix.com' && roleUrl.pathname.startsWith('/careers/co/')
      && ['', '?isComingFromApp=true'].includes(roleUrl.search) && !roleUrl.hash, 'first-party role identity changed')
    const html = await read(roleUrl.href)
    if (currentSSR) currentPublicRoleOpening = currentPublicRole(html, representative)
    else {
      one(script(html, currentDetailClient), 'current full criteria client')
      need(hash(await read(currentDetailClient)) === SHA[currentDetailClient], 'unreviewed full criteria client contract')
    }
  }
  const inspect = async (rows, phase) => {
    for (const row of rows) {
      const resolvedCountry = nativeCountry(row)
      if (!resolvedCountry) { failures.push({ id: row.uid, phase, reason: 'native workplace country unknown' }); continue }
      if (resolvedCountry !== 'India') continue
      try {
        const html = await read(detailUrl(row.uid))
        let raw
        if (currentSSR) {
          const original = { id: row.uid, phase, originalText: html }
          nativeDetailObservations.push(original)
          raw = JSON.parse(html); original.originalRecord = raw
        }
        const job = detail(html, row)
        if (currentSSR) {
          if (row.uid === representative.uid) {
            const criteria = raw.details.map(section => section.name + ' ' + extractActiveDescription(section.value)).join(' ').replace(/\s+/g, ' ').trim()
            need(criteria === currentPublicRoleOpening.criteriaText.replace(/\s+/g, ' ').trim(), 'current public/native complete criteria differ')
          }
          Object.assign(job, { sourceDetailComplete: false, nativeCriteriaTextComplete: true,
            sourceDetailFailureKind: 'current-native-criteria-data-rendering-and-application-unqualified',
            sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false,
            sourceNativeRecord: raw, sourceCriteriaPresentation: 'Full original native criteria as data; renderer and application unqualified' })
        }
        if (phase === 'closing' && !equal(observed.get(row.uid), job)) failures.push({ id: row.uid, phase, reason: 'full criteria changed at closing' })
        if (phase === 'opening') observed.set(row.uid, job)
      } catch (error) { signal.throwIfAborted(); if (/public HTTP/.test(error.message)) throw error; failures.push({ id: row.uid, phase, reason: error.message }) }
    }
  }
  await inspect(opening, 'opening')
  need(await context() === currentClient, 'current declared deployment changed before closing')
  const closingBeforeDetails = listing(await read(LIST))
  await inspect(closingBeforeDetails, 'closing')
  const closing = listing(await read(LIST)), unchanged = equal(projection(opening), projection(closingBeforeDetails)) && equal(projection(opening), projection(closing))
  if (currentSSR && representative) {
    currentPublicRoleClosing = currentPublicRole(await read(representative.url_active_page), representative)
    need(equal(currentPublicRoleOpening.model, currentPublicRoleClosing.model), 'current public complete model changed at closing')
  }
  if (!unchanged) failures.push({ phase: 'closing-inventory', reason: 'current public membership changed after full closing details' })
  const bad = new Set(failures.map(row => row.id)), active = new Map(closing.map(row => [row.uid, row]))
  let jobs = [...observed.values()].filter(job => !bad.has(job.jobId) && active.has(job.jobId)
    && equal(opening.find(row => row.uid === job.jobId), active.get(job.jobId)))
  const limited = Number.isSafeInteger(options.maxJobs) && options.maxJobs > 0 && jobs.length > options.maxJobs
  if (limited) jobs = jobs.slice(0, options.maxJobs)
  const complete = unchanged && !failures.length && !limited
  attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: LIST, firstParty: true,
    listingComplete: complete, lifecycleCleanupAllowed: false, pagesFetched: responses.length, reportedTotal: opening.length, indiaFacetCount: complete ? jobs.length : null,
    verifiedAt: new Date().toISOString(), reason: 'Current corporate-declared exact Comeet tenant, reviewed complete-array client, native countries, same-ID full criteria and final membership after closing details; public-board scope only.'
      + (currentSSR ? ' Native criteria data retained; rendered criteria and application controls unqualified.' : '') })
  if (!complete) attachSourceObservationEvidence(jobs, { source: 'coralogix', recordKind: 'vacancy-rows', observedRecordCount: opening.length, observedVacancyCount: opening.length, sourceScopeComplete: false })
  const audit = { source: 'coralogix', opening, closing, observedDetails: [...observed.values()], sourceCompanyWideScopeComplete: false, lifecycleCleanupAllowed: false, failures, limited, responses,
    ...(currentSSR ? { currentPublicRoleOpening, currentPublicRoleClosing, nativeDetailObservations,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null } : {}) }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  signal.throwIfAborted()
  for (const job of jobs) job.scrapedAt = (options.now || (() => new Date().toISOString()))()
  return jobs
}
