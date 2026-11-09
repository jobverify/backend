import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { createAvaamoReader } from './boundedRead.js'
import { AVAAMO_CAREERS_URL, AVAAMO_COLLECTION_EVIDENCE, parseAvaamoListing, parseAvaamoDetail, explicitAvaamoCountry } from './currentNative.js'
import { PROVIDER_METADATA } from './catalog.js'

export { AVAAMO_COLLECTION_EVIDENCE, parseAvaamoListing, parseAvaamoDetail, explicitAvaamoCountry, PROVIDER_METADATA }
export const SOURCE = 'avaamo'
export const COMPANY = 'Avaamo'
export const VERIFIED_ON = '2026-11-05'
export const CAREERS_URL = AVAAMO_CAREERS_URL
export const DISPOSITION = 'current-first-party-framer-role-observations'
export const VERIFIED_SURFACE_SUMMARY = 'Current first-party Framer careers cards and canonical role pages are read as bounded public GETs. City-only countries and absent role criteria stay unresolved; company and India totals are not inferred.'

export const extractListingCards = (html, finalUrl = CAREERS_URL) => parseAvaamoListing(html, finalUrl).roles
export const hasOfficialCareersPageSignal = html => { try { return extractListingCards(html).length > 0 } catch { return false } }
export const hasOfficialDetailPageSignal = (html, listing) => { try { return parseAvaamoDetail(html, listing).sourceDetailComplete } catch { return false } }

const sameInventory = (left, right) => JSON.stringify([...left].sort((a, b) => a.detailUrl.localeCompare(b.detailUrl)))
  === JSON.stringify([...right].sort((a, b) => a.detailUrl.localeCompare(b.detailUrl)))
const fail = message => Object.assign(new Error('Avaamo current native contract: ' + message), { abortRetries: true })

export const createAvaamoScraper = (factoryOptions = {}) => ({
  async run(options = {}) {
    const settings = { ...factoryOptions, ...options }
    const reader = createAvaamoReader(settings)
    try {
      reader.check()
      const first = await reader.read(CAREERS_URL)
      const opening = parseAvaamoListing(first.html, first.url, { check: reader.check })
      reader.check()
      if (opening.roles.length > reader.limits.maxJobs) throw fail('job count budget exceeded')
      const jobs = [], exclusions = [], failures = []
      for (const listing of opening.roles) {
        reader.check()
        const page = await reader.read(listing.detailUrl)
        const detail = parseAvaamoDetail(page.html, listing, { check: reader.check })
        reader.check()
        const country = explicitAvaamoCountry(listing.location)
        if (detail.closedNotice) {
          exclusions.push({ id: listing.detailUrl.split('/').at(-1), reason: 'native-role-closed', notice: detail.closedNotice })
          continue
        }
        // Incomplete India details must not pass the shared publishing policy,
        // which permits enrichment of missing descriptions. Unknown/foreign
        // observations remain inspectable and are independently ineligible.
        if (country === 'India' && !detail.sourceDetailComplete) {
          exclusions.push({ id: listing.detailUrl.split('/').at(-1), reason: 'missing-role-criteria' })
          continue
        }
        if (!detail.sourceDetailComplete) failures.push({ stage: 'native-content', url: listing.detailUrl, failureKind: detail.sourceDetailFailureKind })
        const requirements = detail.sourceSections.filter(section => /qualifications|requirements|skills/i.test(section.heading || ''))
        const job = {
          source: SOURCE, company: COMPANY, nativeLegalEmployer: detail.organization.legalName,
          title: listing.title, originalTitle: listing.title,
          jobId: listing.detailUrl.split('/').at(-1), requisitionId: null,
          sourceUrl: listing.detailUrl, applyUrl: listing.detailUrl, link: listing.detailUrl,
          companyCareerPage: CAREERS_URL, companyDomain: 'avaamo.ai',
          department: listing.department, location: listing.location, city: null, country,
          sourceCountryScopeUnresolved: country === null, sourceNativeLocation: listing.location,
          sourceCountryEvidence: country ? { kind: 'explicit-native-location-country', label: listing.location, country } : null,
          employmentType: listing.employmentType, remoteStatus: /\bremote\b/i.test(listing.location) ? 'Remote' : null,
          experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
          requirements: requirements.map(section => section.text), postingDate: null, closingDate: null,
          jobDescription: detail.sourceDescription, sourceDescription: detail.sourceDescription,
          sourceDescriptionHtml: detail.sourceDescriptionHtml, sourceSections: detail.sourceSections,
          sourceDetailComplete: detail.sourceDetailComplete, sourceDetailStatus: detail.sourceDetailComplete ? 'complete' : 'partial',
          sourceDetailFailureKind: detail.sourceDetailFailureKind,
          sourceScopeComplete: false, sourceListingComplete: true, lifecycleCleanupAllowed: false,
          sourceApplicationHandoff: detail.sourceApplicationHandoff, applicationVisited: false,
          sourceNativePayload: {
            listing: { ...listing }, organization: detail.organization,
            detail: { url: page.url, rawHtml: page.html, rawContentHtml: detail.rawContentHtml,
              contentSourceOffsets: detail.contentSourceOffsets, documentSHA256: detail.documentSHA256,
              fullRoleCriteriaPresent: detail.sourceDetailComplete },
          },
        }
        reader.check()
        jobs.push(job)
      }
      const last = await reader.read(CAREERS_URL)
      const closing = parseAvaamoListing(last.html, last.url, { check: reader.check })
      reader.check()
      if (!sameInventory(opening.roles, closing.roles)) throw fail('opening and closing native inventory changed')
      const clock = (settings.now || (() => new Date().toISOString()))()
      reader.check()
      if (typeof clock !== 'string' || !Number.isFinite(Date.parse(clock))) throw fail('invalid source observation clock')
      const unknown = opening.roles.filter(role => explicitAvaamoCountry(role.location) === null)
      const summary = {
        source: SOURCE, sourceObservedAt: clock, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
        observedListingCount: opening.roles.length, observedVacancyCount: opening.roles.length,
        responsiveCardCount: opening.responsiveCardCount, openingClosingMatch: true, closingInventoryMatches: true,
        openingNativeRecords: opening.roles, closingNativeRecords: closing.roles,
        openingBodySHA256: first.sha256, closingBodySHA256: last.sha256,
        unknownCountryCount: unknown.length, unknownCountryRoles: unknown.map(role => ({ title: role.title, url: role.detailUrl, location: role.location })),
        fullRoleCriteriaCount: jobs.filter(job => job.sourceDetailComplete).length,
        candidateDetails: opening.roles.length, extractedDetailJobs: jobs.length,
        excludedDetailJobs: exclusions.length, exclusions, failures, listingPaginationComplete: true,
        retainedResponses: reader.receipts.map(receipt => ({ ...receipt })),
        sourceListingComplete: false, lifecycleCleanupAllowed: false, ...reader.stats(),
      }
      for (const job of jobs) job.scrapedAt = clock
      if (jobs.length) jobs[0].nativeCollectionEvidence = summary
      Object.defineProperty(jobs, AVAAMO_COLLECTION_EVIDENCE, { value: summary, configurable: true })
      attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows',
        observedRecordCount: opening.roles.length, observedVacancyCount: opening.roles.length,
        sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
      attachInventoryEvidence(jobs, {
        status: 'discovery-only', surface: CAREERS_URL, firstParty: true, listingComplete: false,
        pagesFetched: reader.stats().pages, reportedTotal: null, indiaFacetCount: null, verifiedAt: clock,
        reason: `Observed ${opening.roles.length} native role cards with stable opening/closing records; ${unknown.length} countries unresolved; ${failures.length} authored-criteria gaps; company hiring scope unverified`,
      })
      reader.check()
      // Cover final projection/serialization work with the same source deadline.
      const size = Buffer.byteLength(JSON.stringify(jobs))
      reader.check()
      if (size > reader.limits.maxOutputBytes) throw fail('output byte budget exceeded')
      return jobs
    } catch (caught) {
      if (settings.signal?.aborted) throw settings.signal.reason
      throw caught
    } finally { reader.close() }
  },
})

export const run = options => createAvaamoScraper().run(options)
