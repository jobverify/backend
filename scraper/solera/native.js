import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { workdayCorporateExecutableSignature } from '../../scraper-support/shared/workdayCurrentSourceScope.js'
import { currentWorkdayBoardReceipt, hasRecognizedWorkdayCountry, WORKDAY_COUNTRY_INVENTORY_PROOF } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { readNativeDocument, activeScripts, activeIframeSources, activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { auditSoleraRawScope } from './nativeRawScope.js'

const directory = path.dirname(fileURLToPath(import.meta.url))
const OFFICIAL = 'https://www.solera.com/careers/'
const BOARD = 'https://solera.wd5.myworkdayjobs.com/Global_Career_Site'
const API = 'https://solera.wd5.myworkdayjobs.com/wday/cxs/solera/Global_Career_Site/jobs'
const reviewedScope = JSON.parse(readFileSync(new URL('./reviewedNativeScope.json', import.meta.url), 'utf8'))
const RECRUITING = /(?:^|\.)(?:greenhouse\.io|ashbyhq\.com|lever\.co|myworkdayjobs\.com|myworkdaysite\.com|smartrecruiters\.com|workable\.com|icims\.com|successfactors\.com|successfactors\.eu|taleo\.net|jobs2web\.com|teamtailor\.com|personio\.com|bamboohr\.com|freshteam\.com|applytojob\.com|breezy\.hr|recruitee\.com|jobvite\.com|keka\.com|darwinbox\.com|darwinbox\.in)$/i
const requireNative = (condition, reason) => { if (!condition) throw new Error(`Solera native inventory: ${reason}`) }
const withoutSlash = value => value.replace(/\/$/, '')

async function corporateSnapshot(signal) {
  signal?.throwIfAborted()
  const response = await fetch(OFFICIAL, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' }, redirect: 'error' })
  const html = await response.text()
  signal?.throwIfAborted()
  requireNative(response.status === 200 && Buffer.byteLength(html) <= 3000000, 'invalid corporate HTTP response')
  const receipt = currentWorkdayBoardReceipt({ officialCareersUrl: OFFICIAL, boardUrl: BOARD, response, html })
  const head = activeHead(html), document = readNativeDocument(html), reasons = [], hiring = []
  const executableSignature = workdayCorporateExecutableSignature(html)
  if (!reviewedScope.corporateExecutableSignatures.includes(executableSignature)) reasons.push('unreviewed-corporate-script-form-or-handler-surface')
  requireNative(head.titles.length === 1 && /Solera/i.test(head.titles[0]) && /Jobs|Career/i.test(head.titles[0]), 'corporate employer identity changed')
  for (const node of document.nodes(node => node.tag === 'a' && node.attrs.href)) {
    let url
    try { url = new URL(node.attrs.href, OFFICIAL) } catch { continue }
    const text = document.text(node)
    if (!RECRUITING.test(url.hostname) && !/career|jobs?|apply|resume|recruit|vacanc|open (?:roles?|positions?)/i.test(`${url.pathname} ${text}`)) continue
    hiring.push(url.href)
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search
      && (withoutSlash(url.href.split('#')[0]) === withoutSlash(OFFICIAL) || url.href === BOARD)) continue
    reasons.push('additional-advertised-hiring-inventory')
  }
  for (const value of activeIframeSources(html)) {
    let url
    try { url = new URL(value, OFFICIAL) } catch { reasons.push('unreviewed-corporate-frame'); continue }
    if (!['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'].includes(url.hostname)) reasons.push('unreviewed-corporate-frame')
  }
  if (activeScripts(html).some(body => /["']@type["']\s*:\s*(?:["']JobPosting["']|\[[^\]]*["']JobPosting["'])/i.test(body))) reasons.push('unreconciled-corporate-posting')
  return { receipt, executableSignature, reasons: [...new Set(reasons)],
    signature: createHash('sha256').update(JSON.stringify([hiring.sort(), executableSignature])).digest('hex') }
}

export async function runCurrentSoleraInventory(options = {}) {
  const { signal, onAudit } = options
  signal?.throwIfAborted()
  requireNative(!options.fetchText && !options.fetchJson && !options.fetchImpl, 'native HTTP response metadata is required; body-only transport overrides are unsupported')
  requireNative(options.maxJobs == null && options.maxPages == null, 'inventory caps and page limits are unsupported')
  const opening = await corporateSnapshot(signal)
  const rawOpening = await auditSoleraRawScope({ apiUrl: API, boardUrl: BOARD, schema: reviewedScope, signal, requestTimeoutMs: options.requestTimeoutMs, requestScheduler: options.requestScheduler })
  // The current global board has unresolved foreign location strings. Keep its
  // proven India roles without turning the global discovery into cleanup proof.
  const rawJobs = await runVerifiedWorkdayBoardUnion({ source: 'solera', company: 'Solera',
    boards: [{ tenant: 'solera', site: 'Global_Career_Site', baseUrl: BOARD, scraperDir: directory }],
    employerPattern: /^(?:2152 SmartDrive Systems \(India\) Private Limited|2124 DealerSocket \(India\) Pvt\. Ltd\.|2165 Spireon Telematics India Pvt Ltd)$/,
    completeSourceScope: false, allowUnresolvedCountryScope: true,
    scopeReason: 'solera-global-native-country-scope-unresolved-proven-india-only',
  }, options)
  const rawClosing = await auditSoleraRawScope({ apiUrl: API, boardUrl: BOARD, schema: reviewedScope, signal, requestTimeoutMs: options.requestTimeoutMs, requestScheduler: options.requestScheduler })
  const closing = await corporateSnapshot(signal)
  const reasons = [...opening.reasons, ...closing.reasons, ...rawOpening.reasons, ...rawClosing.reasons]
  if (opening.signature !== closing.signature) reasons.push('corporate-hiring-scope-changed')
  if (rawOpening.listingSignature !== rawClosing.listingSignature || rawOpening.detailSignature !== rawClosing.detailSignature) reasons.push('raw-native-inventory-or-details-changed')
  const nativeProof = rawJobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
  requireNative(nativeProof?.boards?.length === 1, 'missing native global country proof')
  if (nativeProof.boards.some(board => board.reconciliation?.initial.sha256 !== rawOpening.nativeIdentitySignature
    || board.reconciliation?.closing.sha256 !== rawClosing.nativeIdentitySignature)) reasons.push('raw-and-native-country-proof-inventories-disagree')
  if (nativeProof.boards.some(board => !board.countryScopeComplete)) reasons.push('unresolved-global-native-geography')
  // Promotion to complete-source status requires a reviewed source contract,
  // including every secondary location. This repair intentionally stays partial.
  reasons.push('source-complete-secondary-country-contract-unverified')
  const evidence = readInventoryEvidence(rawJobs)
  const incompleteIndiaRoles = []
  const jobs = rawJobs.map(job => {
    const openingDetail = rawOpening.rawDetails.find(row => row.payload.jobPostingInfo.jobReqId === job.requisitionId)
    const closingDetail = rawClosing.rawDetails.find(row => row.payload.jobPostingInfo.jobReqId === job.requisitionId)
    const roleReasons = [...(openingDetail?.roleReasons || []), ...(closingDetail?.roleReasons || [])]
    if (!openingDetail || !closingDetail) roleReasons.push('retained-role-missing-native-opening-or-closing-detail')
    if (openingDetail && closingDetail && openingDetail.nativeDetailSignature !== closingDetail.nativeDetailSignature) roleReasons.push('retained-role-native-detail-changed')
    for (const row of [openingDetail, closingDetail].filter(Boolean)) {
      const info = row.payload.jobPostingInfo
      if (info.jobDescription !== job.sourceDescription || info.title !== job.title || info.externalUrl !== job.sourceUrl
        || row.payload.hiringOrganization?.name !== job.nativeEmployer) roleReasons.push('retained-role-native-extracted-criteria-or-identity-mismatch')
      const dayISO = value => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
        const parsed = new Date(value + 'T00:00:00.000Z')
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed.toISOString() : null
      }
      const nativePostedAt = dayISO(info.startDate), nativeClosingAt = info.endDate == null ? null : dayISO(info.endDate)
      const invalidNativeDate = nativePostedAt === null || info.endDate != null && nativeClosingAt === null
      const locationKey = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : null
      const nativeLocations = [...new Set([info.location, info.jobRequisitionLocation?.descriptor, ...(Array.isArray(info.additionalLocations) ? info.additionalLocations : [])].map(locationKey).filter(Boolean))].sort()
      const extractedLocations = [...new Set((job.locations || []).map(locationKey).filter(Boolean))].sort()
      const countries = [info.country, info.jobRequisitionLocation?.country].filter(country => country != null)
      const countriesMatch = countries.length > 0 && countries.every(country => hasRecognizedWorkdayCountry(country)
        && (country.descriptor === 'India' || country.alpha2Code === 'IN' || country.id === 'c4f78be1a8f14da0ab49ce1162348a5e'))
      if (invalidNativeDate || nativePostedAt !== job.postedAt || nativeClosingAt !== job.closingDate
        || JSON.stringify(nativeLocations) !== JSON.stringify(extractedLocations)
        || info.id !== job.nativeBoardProvenance?.[0]?.nativePostingUid || info.jobReqId !== job.requisitionId
        || !countriesMatch || info.canApply !== true || info.posted !== true) roleReasons.push('retained-role-native-extracted-metadata-mismatch')
    }
    const uniqueReasons = [...new Set(roleReasons)]
    if (uniqueReasons.length) incompleteIndiaRoles.push({ requisitionId: job.requisitionId, reasons: uniqueReasons })
    return { ...job, company: job.nativeEmployer, sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      ...(uniqueReasons.length ? { sourceDetailComplete: false, sourceDetailFailureKind: 'native-detail-reconciliation-unresolved',
        sourceDetailFailureReasons: uniqueReasons, nativeDetailReconciliation: { opening: openingDetail ?? null, closing: closingDetail ?? null } } : {}) }
  })
  if (incompleteIndiaRoles.length) reasons.push('retained-india-role-details-unresolved')
  const proof = { ...nativeProof, completeSourceScope: false }
  Object.defineProperty(jobs, WORKDAY_COUNTRY_INVENTORY_PROOF, { value: proof })
  const audit = { source: 'solera', productionWrites: false, complete: false, reasons: [...new Set(reasons)],
    openingCorporate: opening, closingCorporate: closing, rawOpening, rawClosing, nativeBoards: proof.boards,
    nativeCount: rawOpening.total, returnedIndiaJobs: jobs.length, incompleteIndiaRoles,
    nativeEmployers: [...new Set(jobs.map(job => job.nativeEmployer))] }
  if (jobs.length) jobs[0].nativeGlobalInventoryEvidence = audit
  onAudit?.(structuredClone(audit))
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs, { ...evidence, listingComplete: false, status: 'coverage-gap',
    reportedTotal: null, indiaFacetCount: null, reason: `solera-source-incomplete:${audit.reasons.join(';')}` })
}
