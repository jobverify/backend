import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBoundedPublicCareerTransport } from '../../scraper-support/utils/boundedPublicCareerTransport.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

import DATA_CORE_SYSTEMS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DATA_CORE_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const JOBS_BOARD_URL = PROVIDER_METADATA.officialJobsBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialBambooHrBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<meta[^>]+property=["']og:title["'][^>]+content=["']Current Openings["']/i.test(page)
    && /<meta[^>]+property=["']og:description["'][^>]+content=["']Take a look at the current openings at Data-Core System, Inc\./i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Data-Core System, Inc\.["']/i.test(page)
}

const toLocationLabel = (item = {}) => {
  const city = normalizeWhitespace(item?.location?.city)
  const state = normalizeWhitespace(item?.location?.state)
  return [city, state].filter(Boolean).join(', ') || null
}

const toCity = (item = {}) => normalizeWhitespace(item?.location?.city) || null

export const extractJobs = (payload = {}) => {
  if (!Array.isArray(payload?.result) || !Number.isSafeInteger(payload?.meta?.totalCount)
    || payload.meta.totalCount !== payload.result.length) throw Error('Data-Core native listing is malformed or truncated')
  const result = Array.isArray(payload?.result) ? payload.result : []

  return result
    .map((item) => {
      const jobId = normalizeWhitespace(item?.id)
      if (!jobId) return null
      if (/^(?:LCA\s+Notices?|Labor\s+Condition\s+Application\s+Notices?|Notice\s+of\s+Filing)\b/i.test(normalizeWhitespace(item.jobOpeningName))) return null

      const sourceUrl = `${JOBS_BOARD_URL}/${jobId}`
      const supplied = [item.location?.countryCode, item.location?.country].filter(value => value != null)
      const countries = supplied.map(value => typeof value === 'string' ? nativeCountryName(value) : null)
      const country = countries.length && countries.every(value => value && value === countries[0]) ? countries[0] : null
      const nativeLocation = toLocationLabel(item)

      return {
        title: normalizeWhitespace(item?.jobOpeningName),
        company: COMPANY,
        department: normalizeWhitespace(item?.departmentLabel) || null,
        location: country ? [nativeLocation, country].filter(Boolean).join(', ') : null,
        city: country ? toCity(item) : null,
        country,
        locations: country ? [{ city: toCity(item), state: item.location?.state ?? null, country }] : [],
        nativeLocation,
        nativeSourceRecord: structuredClone(item),
        sourceCountryScopeUnresolved: !country,
        sourceDetailComplete: false,
        sourceDetailFailureKind: country ? 'native-full-description-unavailable' : 'native-country-unavailable',
        sourceScopeComplete: false,
        sourceListingComplete: false,
        lifecycleCleanupAllowed: false,
        jobId,
        requisitionId: null,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(item?.employmentStatusLabel) || null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: item?.isRemote ? 'Remote' : null,
      }
    })
    .filter((job) => job?.title && job?.sourceUrl)
}

export const createDataCoreSystemsScraper = (defaults = {}) => ({
  async run(passed = {}) {
    const options = { ...defaults, ...passed }, now = options.now || (() => new Date().toISOString())
    options.signal?.throwIfAborted()
    if (options.maxJobs === 0) return attachInventoryEvidence([], { status: 'coverage-gap', surface: CAREERS_URL,
      firstParty: true, listingComplete: false, pagesFetched: 0, verifiedAt: now(), reason: 'caller-cap-zero-no-public-reads' })
    const transport = createBoundedPublicCareerTransport({ source: SOURCE, ...options,
      allowedURL: (url, method) => method === 'GET' && [CAREERS_URL, JOBS_BOARD_URL, JOBS_API_URL].includes(url) })
    const { fetchText, fetchJson } = transport
    try {
    const primary = readNativeDocument(await fetchText(CAREERS_URL))
    if (!primary.nodes(node => node.tag === 'a' && node.attrs.href && new URL(node.attrs.href, CAREERS_URL).href === JOBS_BOARD_URL).length)
      throw Object.assign(Error('Data-Core current native publisher handoff is unqualified'), { abortRetries: true, incompleteScope: true })
    const boardHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasOfficialBambooHrBoardSignal(boardHtml)) {
      throw new Error('Data-Core Systems official BambooHR board no longer matches the trusted public surface')
    }

    const payload = await fetchJson(JOBS_API_URL)
    const jobs = extractJobs(payload)

    const result = jobs.slice(0, options.maxJobs ?? jobs.length).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
    return attachInventoryEvidence(result, { status: 'coverage-gap', surface: CAREERS_URL, firstParty: true,
      listingComplete: false, pagesFetched: 3, reportedTotal: payload.meta.totalCount, verifiedAt: now(),
      reason: 'native-listing-only;full-public-role-descriptions-and-company-inventory-unqualified' })
    } catch (error) {
      if (error.publicReadFailure) Object.assign(error, { abortRetries: true, incompleteScope: true,
        recruitmentObservations: { source: SOURCE, failures: [{ stage: 'current-public-publisher', status: error.status ?? null }],
          unresolved: ['native-current-publisher-identity-or-transport-unqualified'], sourceScopeComplete: false } })
      throw error
    } finally { transport.close() }
  },
})

export const run = async (options = {}) => createDataCoreSystemsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
