import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { extractTextFromPdfBuffer } from '../../scraper-support/shared/pdfText.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const key = text => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const failure = message => Object.assign(Error('Locobuzz native ' + message), {
  softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap', abortRetries: true,
  sourceScopeComplete: false, lifecycleCleanupAllowed: false,
})
const need = (value, message) => { if (!value) throw failure(message) }
const classes = (node, prefix) => (node.attrs.class || '').split(/\s+/).some(name => name.startsWith(prefix))
const one = (nodes, label) => { need(nodes.length === 1, 'missing or ambiguous ' + label); return nodes[0] }
const indiaLocations = value => String(value).split(/\s*[/,]\s*/).every(city =>
  /^(?:Mumbai(?: \((?:Andheri(?: office)?|Onsite)\))?|Gurugram|Bengaluru)$/i.test(city.trim()))
const locationKey = value => key(value.replace(/\boffice\b/gi, ''))
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const hasCurrentLocobuzzInventory = html => {
  const doc = readNativeDocument(html)
  return doc.nodes(node => node.tag === 'section' && node.attrs.id === 'roles').length > 0
}

export function readCurrentLocobuzzCards(html, sourceURL = 'https://locobuzz.com/careers/') {
  need(['https://locobuzz.com/careers', 'https://locobuzz.com/careers/'].includes(sourceURL), 'publisher URL changed')
  const active = readNativeDocument(html)
  const title = one(active.nodes(node => node.tag === 'title'), 'publisher title')
  need(title.raw === 'Careers at Locobuzz | Join Our CX AI Team | Locobuzz', 'publisher title changed')
  need(active.nodes(node => node.tag === 'h1' && active.text(node) === 'Locobuzz. For people, by people.').length === 1,
    'current publisher heading changed')
  const organizations = []
  for (const script of active.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json' && !node.attrs.src)) {
    try {
      const value = JSON.parse(script.raw)
      if (value['@context'] === 'https://schema.org') organizations.push(...(value['@graph'] || []).filter(row => row['@type'] === 'Organization'))
    } catch { /* Malformed structured data cannot identify the publisher. */ }
  }
  need(organizations.filter(row => row.name === 'Locobuzz' && row.legalName === 'Locobuzz Solutions Pvt. Ltd.'
    && ['https://locobuzz.com', 'https://locobuzz.com/'].includes(row.url)).length === 1, 'corporate employer identity changed')
  const doc = document(html)
  const section = one(doc.nodes(node => node.tag === 'section' && node.attrs.id === 'roles'), 'current roles section')
  const count = one(doc.nodes(node => classes(node, 'Careers_rolesCount__'), section), 'published role count')
  const reported = doc.text(count).match(/^(\d+)\s+roles open\b/)
  const rows = doc.nodes(node => classes(node, 'Careers_role__'), section)
  need(reported && Number(reported[1]) === rows.length && rows.length > 0 && rows.length <= 40, 'published role count is unreconciled')
  const cards = rows.map(row => {
    const title = doc.text(one(doc.nodes(node => classes(node, 'Careers_roleTitle__'), row), 'role title'))
    const department = doc.text(one(doc.nodes(node => classes(node, 'Careers_dept__'), row), 'native department'))
    const rawLocation = doc.text(one(doc.nodes(node => classes(node, 'Careers_chip__'), row), 'native work location'))
    need(title && department && indiaLocations(rawLocation), 'role location is outside the declared India city profile')
    const link = one(doc.nodes(node => node.tag === 'a' && doc.text(node) === 'View job description', row), 'declared job description')
    const documentURL = new URL(link.attrs.href, sourceURL)
    need(documentURL.origin === 'https://locobuzz.com' && /^\/careers\/jd\/[a-z0-9-]+\.pdf$/.test(documentURL.pathname)
      && !documentURL.search && !documentURL.hash && !documentURL.username && !documentURL.password, 'document URL identity changed')
    const application = one(doc.nodes(node => node.tag === 'a' && doc.text(node) === 'Apply Job', row), 'role application')
    const applyURL = new URL(application.attrs.href)
    need(applyURL.protocol === 'mailto:' && applyURL.pathname === 'careers@locobuzz.com'
      && [...applyURL.searchParams].length === 1 && applyURL.searchParams.has('subject')
      && key(applyURL.searchParams.get('subject')) === key('Application ' + title), 'role application identity changed')
    const meta = one(doc.nodes(node => classes(node, 'Careers_roleMeta__'), row), 'role metadata')
    const experienceRequired = doc.text(meta).replace(/\s*View job description\s*$/, '').replace(/\s*·\s*$/, '').trim() || null
    return { title, department, rawLocation, country: 'India', location: rawLocation + ', India',
      sourceUrl: sourceURL, documentURL: documentURL.href, applyUrl: applyURL.href, experienceRequired,
      cardHTML: doc.outer(row) }
  })
  need(new Set(cards.map(card => card.documentURL)).size === cards.length
    && new Set(cards.map(card => slug(card.title))).size === cards.length, 'duplicate native role identity')
  return cards
}

export function readLocobuzzPdfRole(card, text) {
  need(typeof text === 'string' && text.length >= 1000 && text.length <= 100000, 'full document criteria unavailable')
  const spaced = value => [...value].join('\\s*')
  const header = text.match(new RegExp('^([\\s\\S]+?)\\s+' + spaced('ROLE') + '\\s+([\\s\\S]+?)\\s+'
    + spaced('LOCATION') + '\\s+([\\s\\S]+?)\\s+' + spaced('DEPARTMENT') + '\\s+([\\s\\S]+?)\\s+▪\\s+ABOUT\\s+LOCOBUZZ\\s+', 'i'))
  need(header && key(header[2]) === key(card.title) && locationKey(header[3]) === locationKey(card.rawLocation)
    && indiaLocations(header[3]) && key(header[4]) === key(card.department), 'document title, department or country identity changed')
  const employerStatement = text.slice(header[0].length).split(/▪\s+ABOUT\s+THE\s+ROLE\b/i)[0].replace(/\s+/g, ' ').trim()
  need(employerStatement.startsWith('Locobuzz builds AI-powered Customer Experience technology that helps global brands'),
    'document employer identity changed')
  const compact = text.toUpperCase().replace(/[^A-Z]/g, '')
  need(['ABOUTTHEROLE', 'KEYRESPONSIBILITIES', 'KEYSKILLSWHATWERELOOKINGFOR', 'WHYLOCOBUZZ'].every(label => compact.includes(label)),
    'full responsibility, qualification or final document section unavailable')
  need(!/\b(?:this (?:job|position|role) is (?:closed|filled)|no longer accepting applications)\b/i.test(text), 'role is closed')
  return { nativeRoleTitle: header[2].trim(), nativeLocation: header[3].trim(), nativeDepartment: header[4].trim(),
    employerStatement, description: text }
}

const defaultFetchPdf = async (url, { signal } = {}) => {
  const boundedSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)])
  const response = await fetch(url, { redirect: 'manual', signal: boundedSignal, headers: { Accept: 'application/pdf' } })
  const contentType = response.headers.get('content-type') || ''
  if (response.status !== 200 || response.url !== url || !/^application\/pdf\b/i.test(contentType)) {
    await response.body?.cancel()
    throw Object.assign(failure('document response identity changed; HTTP ' + response.status), { status: response.status })
  }
  const reader = response.body.getReader(), chunks = []
  let size = 0
  try {
    while (true) {
      boundedSignal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      need(size <= 2 * 1024 * 1024, 'document exceeds the source byte limit')
      chunks.push(value)
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error }
  finally { reader.releaseLock() }
  return { status: response.status, url: response.url, contentType, bytes: Buffer.concat(chunks) }
}

export async function collectLocobuzzCurrentJobs({ html, sourceURL, readClosingPage, fetchPdf = defaultFetchPdf,
  now = () => new Date().toISOString(), signal }) {
  const cards = readCurrentLocobuzzCards(html, sourceURL), jobs = [], failures = [], reasons = []
  let pagesFetched = 1
  for (const card of cards) {
    try {
      signal?.throwIfAborted()
      const response = await fetchPdf(card.documentURL, { signal })
      signal?.throwIfAborted()
      need(response?.status === 200 && response.url === card.documentURL && /^application\/pdf\b/i.test(response.contentType || '')
        && response.bytes instanceof Uint8Array && response.bytes.length <= 2 * 1024 * 1024
        && Buffer.from(response.bytes.subarray(0, 5)).toString() === '%PDF-', 'document response identity or bytes changed')
      const text = await extractTextFromPdfBuffer(response.bytes, { signal, timeoutMs: 15000 })
      const native = readLocobuzzPdfRole(card, text)
      pagesFetched++
      jobs.push({ title: card.title, company: 'Locobuzz', source: 'locobuzz', jobId: slug(card.title), requisitionId: slug(card.title),
        department: card.department, location: card.location, country: 'India', city: card.rawLocation.includes('/') ? null : 'Mumbai',
        sourceUrl: sourceURL, sourceDetailUrl: card.documentURL, applyUrl: card.applyUrl, link: card.applyUrl,
        sourceDescription: native.description, jobDescription: native.description, experienceRequired: card.experienceRequired,
        employmentType: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
        postingDate: null, closingDate: null, remoteStatus: null, sourcePublicationDateUnavailable: true,
        sourceRemoteStatusUnresolved: true, sourceDetailComplete: true, sourceScopeComplete: false,
        sourceListingComplete: false, lifecycleCleanupAllowed: false, applicationVisited: false, scrapedAt: now(),
        nativeHiringOrganization: { name: 'Locobuzz', legalName: 'Locobuzz Solutions Pvt. Ltd.' },
        nativeEmployerBinding: { method: 'explicit-first-party-publisher-and-role-document-employer',
          surface: card.documentURL, statement: native.employerStatement },
        nativeCountryEvidence: { method: 'matching-card-and-document-reviewed-india-cities',
          listingLocation: card.rawLocation, documentLocation: native.nativeLocation },
        nativeSourceRecord: { ...card, ...native, publisherDocumentSHA256: sha(html),
          pdfSHA256: sha(response.bytes), pdfBytes: response.bytes.length, nativeDocumentText: text } })
    } catch (error) {
      signal?.throwIfAborted()
      if (!jobs.length) throw error
      failures.push({ stage: 'native-role-document', title: card.title, url: card.documentURL, message: error.message })
      reasons.push('native-document-collection-incomplete'); break
    }
  }
  const signature = value => JSON.stringify(value.map(({ cardHTML, ...card }) => card))
  try {
    const closing = await readClosingPage(); pagesFetched++
    if (signature(readCurrentLocobuzzCards(closing.html, closing.url)) !== signature(cards)) reasons.push('closing-native-inventory-changed')
  } catch (error) {
    signal?.throwIfAborted()
    reasons.push('closing-native-inventory-unavailable'); failures.push({ stage: 'closing-inventory', message: error.message })
  }
  for (const job of jobs) Object.assign(job, { nativeBoardListingComplete: reasons.length === 0, nativeCollectionFailures: failures })
  attachSourceObservationEvidence(jobs, { source: 'locobuzz', recordKind: 'vacancy-rows', observedRecordCount: cards.length,
    observedVacancyCount: cards.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: sourceURL, firstParty: true,
    listingComplete: false, lifecycleCleanupAllowed: false, reportedTotal: cards.length, indiaFacetCount: cards.length,
    pagesFetched, verifiedAt: now(), reason: (reasons.length ? reasons.join(';') : 'native-cards-documents-and-closing-inventory-reconciled')
      + ';company-wide-scope-unverified' })
}
