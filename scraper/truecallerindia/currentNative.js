import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createCurrentDeclaredNativeRead, nativeContract } from '../../scraper-support/utils/currentDeclaredNativeRead.js'
import { criteria, geography, officeIndex, literalFields } from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME = 'https://www.truecaller.com/careers', JOBS = HOME + '/jobs'
const LIST = 'https://api.greenhouse.io/v1/boards/truecaller/jobs?content=true'
const OFFICES = 'https://api.greenhouse.io/v1/boards/truecaller/offices'
// Reviewed original current Nuxt route declarations: the entry selects this
// component for /careers/jobs, whose fetch literals name LIST and OFFICES. The
// role component publishes the exact own-post GET template below. Changed
// executable bytes require another review rather than inferred endpoints.
const assets = [
  ['https://www.truecaller.com/_nuxt/TAwguWCl.js', 'afabf01be7c33c44773afe62173d278c0b266cd3e0d80a97125dd8bfa4682d59'],
  ['https://www.truecaller.com/_nuxt/DBRC6CPw.js', '1327d01538b910de7617a95fce290d4d1f2798c62f6846580a6b8fbee64aac15'],
  ['https://www.truecaller.com/_nuxt/VvYwFOq0.js', '2ec598c346fdc439d6cc3ea5c05e7113bd09f2a37caa5b93b69893b6c24a85ce'],
]
const ownURL = id => 'https://boards-api.greenhouse.io/v1/boards/truecaller/jobs/' + id
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ensure = (value, reason) => nativeContract(value, 'Truecaller current native: ' + reason)
const dateActive = (value, now) => value == null || typeof value === 'string' && Number.isFinite(Date.parse(value))
  && Date.parse(value.length === 10 ? value + 'T23:59:59Z' : value) >= now

export async function runCurrentTruecaller(options = {}) {
  const allowed = new Set([HOME, JOBS, LIST, OFFICES, ...assets.map(([url]) => url)])
  const io = createCurrentDeclaredNativeRead('truecallerindia', url => allowed.has(url), options)
  const clock = typeof options.now === 'function' ? options.now() : options.now ?? new Date().toISOString()
  const now = Date.parse(clock); ensure(Number.isFinite(now), 'invalid observation clock')
  ensure(options.maxJobs == null || Number.isSafeInteger(options.maxJobs) && options.maxJobs >= 0, 'invalid output cap')
  const phase = async () => {
    const home = await io.read(HOME), document = readNativeDocument(home.originalText)
    ensure(document.nodes(node => node.tag === 'title' && /Truecaller.*Careers/i.test(node.raw || '')).length === 1
      && document.nodes(node => node.tag === 'a' && node.attrs.href === '/careers/jobs').length > 0, 'current corporate jobs handoff changed')
    const jobsPage = await io.read(JOBS), jobsDocument = readNativeDocument(jobsPage.originalText)
    ensure(jobsDocument.nodes(node => node.tag === 'script' && node.attrs.type === 'module'
      && new URL(node.attrs.src || '', JOBS).href === assets[0][0]).length === 1, 'current native route entry changed')
    ensure(jobsDocument.nodes(node => node.tag === 'link' && node.attrs.rel === 'modulepreload'
      && new URL(node.attrs.href || '', JOBS).href === assets[1][0]).length === 1, 'current jobs component declaration changed')
    for (const [url, digest] of assets) ensure((await io.read(url)).bodySHA256 === digest, 'reviewed native route/client contract changed')
    const officePage = await io.read(OFFICES), listingPage = await io.read(LIST)
    const offices = io.json(officePage), payload = io.json(listingPage)
    ensure(Array.isArray(payload?.jobs) && Number.isSafeInteger(payload.meta?.total) && payload.meta.total === payload.jobs.length
      && !payload.error && !payload.errors && payload.success !== false && payload.hasMore !== true, 'native listing envelope/total incomplete')
    const index = officeIndex(offices), ids = new Set(), records = []
    for (const listing of payload.jobs) {
      ensure(Number.isSafeInteger(listing?.id) && listing.id > 0 && !ids.has(listing.id) && listing.company_name === 'Truecaller', 'native posting/account identity changed')
      ids.add(listing.id)
      const geo = geography(listing, index)
      // A known India office is positive worksite evidence. Foreign and unknown
      // native records remain in the full original list and never prove zero.
      if (geo.country !== 'India' || geo.sourceNativeCountryConflict || !Number.isSafeInteger(listing.internal_job_id)
        || /open application|talent (?:pool|community)|general application/i.test(listing.title || '')) continue
      const url = ownURL(listing.id); allowed.add(url)
      const detailPage = await io.read(url), detail = io.json(detailPage)
      ensure(detail.id === listing.id && detail.company_name === 'Truecaller' && detail.internal_job_id === listing.internal_job_id,
        'native own posting identity disagrees')
      ensure(['title', 'absolute_url', 'location', 'offices', 'metadata', 'content'].every(key => same(listing[key], detail[key])), 'native list/own criteria or geography disagree')
      const nativeURL = new URL(detail.absolute_url)
      ensure(nativeURL.origin === 'https://job-boards.greenhouse.io' && nativeURL.pathname === '/truecaller/jobs/' + detail.id
        && !nativeURL.search && !nativeURL.hash && !nativeURL.username && !nativeURL.password, 'native public posting URL changed')
      const full = criteria(detail), fields = literalFields(detail), ownGeo = geography(detail, index)
      ensure(full.jobDescription?.length >= 300 && /(?:what|you|responsib|experience|skill|qualification)/i.test(full.jobDescription), 'full authored native criteria unavailable')
      if (!dateActive(detail.application_deadline, now) || ownGeo.country !== 'India' || ownGeo.sourceNativeCountryConflict) continue
      const placementClauses = full.jobDescription.match(/[^.!?]*\b(?:transferable|relocat(?:e|ion|ing))\b[^.!?]*(?:[.!?]|$)/gi) || []
      records.push({ listing, detail, full, fields, geo: ownGeo, detailBodySHA256: detailPage.bodySHA256,
        conditionalForeignPlacement: placementClauses.some(clause => /\b(?:transferable|relocat(?:e|ing|ion))\s+to\b/i.test(clause)), placementClauses })
    }
    return { payload, offices, records, listingBodySHA256: listingPage.bodySHA256, officeBodySHA256: officePage.bodySHA256 }
  }
  const opening = await phase(), closing = await phase()
  ensure(same(opening.payload, closing.payload) && same(opening.offices, closing.offices), 'opening/closing native inventory changed')
  const candidates = closing.records.filter(current => !current.conditionalForeignPlacement && opening.records.some(earlier => earlier.detail.id === current.detail.id && same(earlier.detail, current.detail)))
  const jobs = candidates.slice(0, options.maxJobs ?? candidates.length).map(({ listing, detail, full, fields, geo, detailBodySHA256 }) => ({
    source: 'truecallerindia', company: 'Truecaller India', companyName: 'Truecaller India', title: detail.title.trim(), jobId: String(detail.id),
    internalJobId: detail.internal_job_id, requisitionId: detail.requisition_id ?? null,
    sourceUrl: detail.absolute_url, applyUrl: detail.absolute_url, link: detail.absolute_url,
    ...geo, ...full, ...fields, sourceDescription: full.jobDescription, companyCareerPage: HOME, companyDomain: 'truecaller.com', atsPlatform: 'greenhouse',
    nativeSourceRecord: structuredClone(detail), sourceNativeListingRecord: structuredClone(listing), sourceNativeDetailBodySHA256: detailBodySHA256,
    sourceNativePostingIdentityQualified: true, sourceCurrentNativeRoleQualified: true, sourceNativeDetailQualified: true,
    sourceDetailComplete: true, fullNativeAuthoredCriteriaAvailable: true, sourceScopeComplete: false, sourceListingComplete: false,
    lifecycleCleanupAllowed: false, sourceNativeClosingReconciled: true, scrapedAt: new Date(now).toISOString(),
  }))
  await options.onAudit?.({ source: 'truecallerindia', opening, closing, returnedCount: jobs.length, rawPages: io.pages,
    websiteJavaScriptExecuted: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
  io.signal.throwIfAborted()
  attachSourceObservationEvidence(jobs, { source: 'truecallerindia', recordKind: 'vacancy-rows', observedRecordCount: closing.payload.jobs.length,
    observedVacancyCount: closing.payload.jobs.filter(row => Number.isSafeInteger(row.internal_job_id)).length, sourceScopeComplete: false })
  return attachInventoryEvidence(jobs, { status: jobs.length ? 'discovery-only' : 'coverage-gap', firstParty: true, surface: JOBS,
    listingComplete: false, pagesFetched: io.pages.length, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date(now).toISOString(),
    reason: 'current-corporate-jobs-route-and-reviewed-declared-native-GET;role-owned-india-offices-and-full-own-criteria;opening-closing-reconciled;whole-employer-scope-and-cleanup-unqualified' })
}
