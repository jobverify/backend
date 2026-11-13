import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { createPublishingGapAtsScraper, validatePublicPostingScope } from '../../scraper-support/utils/publishingGapAts.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { readOriginalNativeCriteria } from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import { CAREERS, originalContent, originalContentSegments } from './native.js'

export const CHOWNOW_PUBLIC_API = 'https://api.lever.co/v0/postings/chownow?mode=json'
export const CHOWNOW_OWNERSHIP_REVIEW = Object.freeze({
  source: 'chownow', company: 'ChowNow', officialURL: CAREERS, nativeBoard: 'https://jobs.lever.co/chownow',
  reviewedOn: '2026-11-13', method: 'official-public-careers-role-links-to-exact-native-Lever-namespace',
  scope: 'configured-public-native-account;whole-company-scope-unverified',
  discrepancy: 'The official rendered careers page displayed15 role links; all7 current API records were among those links. Neither reviewed count is a runtime validity requirement.',
})
const need = (value, message) => { if (!value) throw Error('ChowNow current native API: ' + message) }
const provider = { source: 'chownow', companyName: 'Chownow', atsPlatform: 'lever', boardToken: 'chownow',
  companyCareerPage: CAREERS, sourceScopeComplete: false, zeroResultPolicy: 'evidence-required' }
const hash = value => createHash('sha256').update(value).digest('hex')

function validate(records) {
  need(Array.isArray(records) && records.length <= 1000, 'invalid or oversized public posting array')
  const ids = new Set()
  for (const row of records) {
    need(row && typeof row === 'object' && !Array.isArray(row) && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.id || '')
      && !ids.has(row.id) && typeof row.text === 'string' && row.text.trim(), 'missing or duplicate native role identity')
    ids.add(row.id)
    need(row.hostedUrl === `https://jobs.lever.co/chownow/${row.id}` && row.applyUrl === row.hostedUrl + '/apply', 'foreign board or native role URL identity')
    need(row.categories && typeof row.categories === 'object' && !Array.isArray(row.categories)
      && typeof row.categories.location === 'string' && row.categories.location.trim(), 'missing native role geography')
    need(row.createdAt == null || Number.isSafeInteger(row.createdAt) && row.createdAt >= 0 && Number.isFinite(new Date(row.createdAt).getTime()), 'invalid native publication timestamp')
    // Validate every original role, including foreign records, before selection.
    originalContent(row)
    const segments = originalContentSegments(row), failure = reason => Error('ChowNow current native API: ' + reason)
    // Select HTML/plain content exactly as the retained output does. Each
    // authored segment must survive visibility qualification in full; generated
    // list labels and visible boilerplate cannot replace hidden role criteria.
    for (const segment of segments) if (segment.content) readOriginalNativeCriteria(segment.content, failure)
    const criteria = readOriginalNativeCriteria(segments.filter(segment => segment.kind === 'criteria')
      .map(segment => segment.content).join('\n\n'), failure, { minimumChars: 40 })
    need(criteria.sourceDetailComplete, 'active full role criteria missing')
  }
  return validatePublicPostingScope(records, 'lever', provider)
}

export async function runCurrentChownow(options = {}) {
  options.signal?.throwIfAborted()
  const timeoutMs = options.timeoutMs ?? 90000
  need(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 90000, 'invalid source timeout')
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(timeoutMs)])
  const transport = createHTMLTransport({ validateURL: url => need(url === CHOWNOW_PUBLIC_API, 'request outside configured native account'),
    expectedContentType: () => 'application/json' }, { signal, fetchImpl: options.fetchImpl ?? globalThis.fetch, timeoutMs: Math.min(timeoutMs, 20000) })
  const receipts = []
  const read = async phase => {
    signal.throwIfAborted()
    const response = await transport(CHOWNOW_PUBLIC_API)
    signal.throwIfAborted()
    need(response.status === 200 && response.url === CHOWNOW_PUBLIC_API && response.bodyComplete === true, 'incomplete native HTTP receipt')
    need(response.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json', 'native response MIME changed')
    const text = new TextDecoder('utf8', { fatal: true }).decode(response.body)
    readLiteralModel(text)
    const records = JSON.parse(text), countryIssues = validate(records)
    receipts.push({ phase, url: response.url, status: response.status, bodySHA256: hash(response.body),
      bytes: response.body.byteLength, countryIssues })
    return records
  }
  const opening = await read('opening'), closing = await read('closing')
  const ordered = rows => rows.slice().sort((a, b) => a.id.localeCompare(b.id))
  need(isDeepStrictEqual(ordered(opening), ordered(closing)), 'opening and closing complete native records changed')
  signal.throwIfAborted()
  const mapped = await createPublishingGapAtsScraper(provider).run({ signal, fetchJson: async url => {
    need(url === CHOWNOW_PUBLIC_API, 'mapping request outside configured native account')
    return opening
  } })
  const byId = new Map(opening.map(row => [row.id, row]))
  const jobs = mapped.map(job => {
    const row = byId.get(job.jobId), content = originalContent(row)
    return { ...job, sourceDescription: content, jobDescription: content,
      postingDate: row.createdAt == null ? null : new Date(row.createdAt).toISOString(), nativeCreatedAt: row.createdAt ?? null,
      nativeSourceRecord: structuredClone(row), sourceDetailComplete: true, sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, applicationVisited: false,
      sourceNativeOwnershipReview: CHOWNOW_OWNERSHIP_REVIEW }
  })
  signal.throwIfAborted()
  const observation = { source: 'chownow', recordKind: 'vacancy-rows', observedRecordCount: opening.length,
    observedVacancyCount: opening.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null }
  attachSourceObservationEvidence(jobs, observation)
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: { ...observation,
    nativeRecords: structuredClone(opening), closingNativeRecords: structuredClone(closing), receipts,
    openingClosingMatch: true, ownershipReview: CHOWNOW_OWNERSHIP_REVIEW, lifecycleCleanupAllowed: false } })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CHOWNOW_PUBLIC_API, firstParty: true,
    listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: receipts.length,
    verifiedAt: new Date().toISOString(), reason: `Reconciled ${opening.length} complete public native Lever records; configured account ownership reviewed; company scope and corporate/API count discrepancy remain unqualified` })
}
