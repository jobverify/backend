import { createHash } from 'node:crypto'
import { extractPdfTextWorkerCore } from '../../scraper-support/shared/pdfTextWorkerCore.js'
import { createNativePdfTextContext } from '../../scraper-support/shared/nativePdfTextContext20261111.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const CAREERS = 'https://www.cloudphysician.net/careers/'
const ORIGIN = 'https://www.cloudphysician.net'
const APPLICATION = 'mailto:careers@cloudphysician.net'
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim()
const key = value => normalize(value).toLowerCase()
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const need = (value, message) => { if (!value) throw Object.assign(new Error('Cloudphysician ' + message), { abortRetries: true }) }

function listing(html) {
  const document = readNativeDocument(html)
  need(document.nodes(node => node.tag === 'title' && /^Careers at Cloudphysician\b/.test(node.raw?.trim())).length === 1
    && document.nodes(node => node.tag === 'h1' && document.text(node) === 'Careers at Cloudphysician').length === 1,
  'current corporate careers identity changed')
  const bases = document.nodes(node => node.tag === 'base')
  need(bases.length === 1 && bases[0].attrs.href === '/', 'native document base changed or is ambiguous')
  const base = new URL(bases[0].attrs.href, CAREERS)
  const applications = document.nodes(node => node.tag === 'a' && document.text(node) === 'Apply now')
  need(applications.length === 1 && applications[0].attrs.href === APPLICATION, 'native application binding changed')
  const cards = document.nodes(node => node.tag === 'a' && /\.pdf\s*$/i.test(node.attrs.href || '')).map(node => {
    const url = new URL(node.attrs.href.trim(), base)
    need(url.origin === ORIGIN && !url.username && !url.password && !url.search && !url.hash
      && /^\/assets\/jds\/[^/]+\.pdf$/i.test(url.pathname), 'native PDF URL authority changed')
    const title = document.text(node)
    need(title, 'native PDF listing title missing')
    return { title, url: url.href }
  })
  need(cards.length > 0 && cards.length <= 60 && new Set(cards.map(card => card.url)).size === cards.length,
    'native PDF listing missing, duplicated or outside bounds')
  return { cards, application: APPLICATION, documentBase: base.href }
}

async function pdfDocument(bytes, signal) {
  const context = createNativePdfTextContext({signal})
  try {
    const native = await extractPdfTextWorkerCore(bytes, {...context, maxPages: 16, includePageLinks: true})
    need(native.numPages > 0 && native.numPages <= 16, 'native PDF page count outside bounds')
    const pages = native.pageTexts
    need(Array.isArray(pages) && pages.length === native.numPages && Array.isArray(native.pageLinkUrls)
      && native.pageLinkUrls.length === native.numPages, 'native PDF page or annotation results incomplete')
    const applications = []
    for (let index = 0; index < pages.length; index++) {
      need(typeof pages[index] === 'string' && pages[index].length >= 40, 'native PDF has missing or unreadable criteria pages')
      need(Array.isArray(native.pageLinkUrls[index]), 'native PDF annotation results incomplete')
      for (const url of native.pageLinkUrls[index]) if (url === APPLICATION) applications.push(url)
    }
    context.check()
    return {pages, text: pages.join('\n\n'), applications, sha256: sha(bytes)}
  } finally { context.close() }
}

export async function runCurrentCloudphysician(options = {}) {
  options.signal?.throwIfAborted()
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(90000)])
  const now = options.now || (() => new Date().toISOString())
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const allowed = new Set([CAREERS]), receipts = [], records = [], jobs = []
  let aggregateBytes = 0
  const read = async (url, pdf = false) => {
    signal.throwIfAborted()
    need(allowed.has(url) && receipts.length < 130, 'request outside the declared PDF contract')
    const response = await fetchImpl(url, {method: 'GET', redirect: 'error', credentials: 'omit',
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      headers: {Accept: pdf ? 'application/pdf' : 'text/html,application/xhtml+xml'}})
    need(response.url === url, 'response URL authority or redirect changed')
    if (response.status !== 200) throw Object.assign(new Error('Cloudphysician native public HTTP ' + response.status), {
      status: response.status, abortRetries: true, publicReadFailure: true,
    })
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    need(mime === (pdf ? 'application/pdf' : 'text/html'), 'native ' + (pdf ? 'PDF' : 'careers') + ' response MIME changed')
    const chunks = []; let size = 0
    for await (const chunk of response.body) {
      signal.throwIfAborted()
      size += chunk.byteLength
      need(size <= 4e6, 'native response exceeds byte bounds')
      chunks.push(chunk)
    }
    aggregateBytes += size
    need(aggregateBytes <= 32e6, 'native PDF aggregate exceeds byte bounds')
    const bytes = Buffer.concat(chunks)
    need(!pdf || bytes.subarray(0, 5).toString() === '%PDF-', 'native PDF signature changed')
    receipts.push({url, status: response.status, bytes: size, sha256: sha(bytes)})
    return bytes
  }
  const opening = listing((await read(CAREERS)).toString('utf8'))
  for (const card of opening.cards) allowed.add(card.url)
  // Inspect every advertised PDF. A city, corporate address or company India
  // activity is never a vacancy-country field; those observations stay held.
  for (const card of opening.cards) {
    const native = await pdfDocument(await read(card.url, true), signal)
    const heading = normalize(native.pages[0].split(/\bCLOUDPHYSICIAN\b/i)[0])
    const match = heading.match(/^(.+?)\s*\(([^()]+)\)\s*$/)
    const record = {title: card.title, url: card.url, nativeHeading: heading, pages: native.pages.length,
      description: native.text, pdfSHA256: native.sha256, disposition: 'workplace-country-unverified'}
    records.push(record)
    // The reviewed PDF explicitly says "different states in India". PDF text
    // runs can split the ff ligature; both complete spellings retain the same
    // literal country. Negated, remote and mixed-country phrases stay held.
    if (!match || key(match[1]) !== key(card.title)
      || !/^(?:India|(?:different|di ff erent) states in India)$/i.test(normalize(match[2]))) continue
    need(/\bCLOUDPHYSICIAN\b/i.test(native.pages[0]) && /Cloudphysician Healthcare Pvt\. Ltd\./.test(native.text), 'native PDF employer changed')
    need(native.text.length >= 1000 && /JOB DESCRIPTION/i.test(native.text) && /PREFERRED QUALIFICATIONS/i.test(native.text)
      && /How to apply/i.test(native.text) && native.text.includes('careers@cloudphysician.net')
      && native.applications.includes(APPLICATION), 'native PDF full criteria or application binding unavailable')
    record.disposition = 'qualified-native-india-vacancy'
    jobs.push({source: 'cloudphysician', company: 'Cloudphysician', title: card.title,
      jobId: card.url, sourceUrl: card.url, applyUrl: APPLICATION, link: card.url,
      sourceNativeApplicationUrl: APPLICATION, country: 'India', city: null, state: null,
      location: normalize(match[2]), employmentType: null, postingDate: null, closingDate: null,
      jobDescription: native.text, sourceDescription: native.text, sourceDetailComplete: true,
      sourceDescriptionFormat: 'native-pdf-text', nativePdfSHA256: native.sha256, nativePdfPages: native.pages.length,
      sourceCountryEvidence: {field: 'native-PDF-role-heading', value: match[2]},
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: now()})
  }
  const closing = listing((await read(CAREERS)).toString('utf8'))
  need(JSON.stringify(opening) === JSON.stringify(closing), 'closing native listing snapshot changed')
  for (const job of jobs) need(sha(await read(job.sourceUrl, true)) === job.nativePdfSHA256, 'closing native full PDF criteria changed')
  if (!jobs.length) throw Object.assign(new Error('Cloudphysician no qualified native India PDF criteria; inventory remains unavailable'), {
    softFailure: true, failureKind: 'coverage_gap', abortRetries: true,
    recruitmentObservations: {receipts, nativeRecords: records, sourceScopeComplete: false},
  })
  attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: CAREERS, firstParty: true, listingComplete: false,
    pagesFetched: receipts.length, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
    reason: 'Current declared document base resolves ' + records.length + ' native PDF vacancies; ' + jobs.length
      + ' full native India role(s) qualified; remaining vacancy countries/identities and company totals unknown; cleanup forbidden.'})
  attachSourceObservationEvidence(jobs, {source: 'cloudphysician', recordKind: 'vacancy-rows',
    observedRecordCount: records.length, observedVacancyCount: records.length, sourceScopeComplete: false})
  Object.defineProperty(jobs, 'nativeCollectionEvidence', {configurable: true, value: {source: 'cloudphysician',
    recordKind: 'vacancy-rows', observedRecordCount: records.length, observedVacancyCount: records.length,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null, nativeRecords: records, receipts}})
  return jobs
}
