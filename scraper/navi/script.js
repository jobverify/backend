import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {validateNativeInventory,validateNativeDetail} from './nativeContract.js'
import {hydrateTurboHireJobs} from '../../scraper-support/utils/turboHireDetails.js'
import {createPublicTurboHireTransport} from '../../scraper-support/utils/turboHirePublicTransport.js'
import {TURBOHIRE_CURRENT_PUBLIC_CLIENT} from '../../scraper-support/utils/turboHirePublicClient.js'
import {isReviewedNaviClientURL,verifyNaviPublicClient} from './publicClient.js'
import {hasNativeBoardIdentity} from './nativeContent.js'

import { NAVI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NAVI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const TURBOHIRE_BOARD_URL = PROVIDER_METADATA.handoffBoardUrl
export const ORIGIN = 'https://navi.turbohire.co'
export const ORG_ID = PROVIDER_METADATA.turboHireOrgId
export const API_BASE_URL = TURBOHIRE_CURRENT_PUBLIC_CLIENT.apiBaseURL
export const NOAUTH_TOKEN_URL = `${API_BASE_URL}/api/token/noauth`
export const FILTERED_JOBS_URL = `${API_BASE_URL}/api/careerpagev2/filteredjobs?orgId=${ORG_ID}&pageType=0`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LIVE_FILTER_BODY = {
  SortByV2: { Key: 'PostedDate', Order: 2 },
  BunitIds: { Value: null, FilterType: 0 },
  Experience: { Value: null, FilterType: 0 },
  JobTypes: { Value: null, FilterType: 0 },
  JobTypeV2: { Value: null, FilterType: 0 },
  Locations: { Value: null, FilterType: 0 },
  CreatedDate: { Value: null, FilterType: 0 },
  Compensation: { Value: null, FilterType: 0 },
  Skills: { Value: null, FilterType: 0 },
  Keyword: '',
  ClientIds: { Value: null, FilterType: 0 },
  Department: '',
  CustomFields: {},
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const parseLocations = (value) => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const extractPrimaryLocation = (value) => normalizeWhitespace(parseLocations(value).find(p=>typeof p?.Address==='string'&&/,\s*India\s*$/i.test(p.Address))?.Address)

const extractCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null

const formatExperience = (experience = {}) => {
  const min = Number.isFinite(experience?.MinExp) ? experience.MinExp : null
  const max = Number.isFinite(experience?.MaxExp) ? experience.MaxExp : null

  if (min != null && max != null) {
    if (min === max) return `${min} year${min === 1 ? '' : 's'}`
    return `${min}-${max} years`
  }

  if (min != null) return `${min}+ years`
  if (max != null) return `Up to ${max} years`
  return null
}

const inferExperienceFromDescription = (jobDescription) => {
  const normalizedDescription = normalizeWhitespace(jobDescription)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)
  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const buildPublicJobUrl = (jobIdObfuscated) =>
  jobIdObfuscated ? `${ORIGIN}/job/publicjobs/${jobIdObfuscated}` : null

const buildPublicHeaders = (accessToken = null) => {
  const headers = {
    Origin: ORIGIN,
    Referer: TURBOHIRE_BOARD_URL,
    'User-Agent': USER_AGENT,
    Accept: 'application/json, text/plain, */*',
  }

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return headers
}

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml) || ''

  return /<title[^>]*>\s*Careers At Navi \| Join Our Team\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Join us in simplifying finance for a billion people.')
    && /view open roles/i.test(normalized)
    && /https:\/\/navi\.turbohire\.co\/dashboardv2\?orgId=3e818601-0baa-429c-b6f8-4b21903ae0e6(?:&amp;|&)type=0/i.test(rawHtml)
}

export const extractTurboHireHandoffUrl = html => extractOfficialRecruitmentLinks(String(html??''),CAREERS_PAGE_URL).find(link=>link.href===TURBOHIRE_BOARD_URL)?.href || null

export const hasOfficialBoardSignal = hasNativeBoardIdentity

export const buildFilteredJobsRequestBody = () => JSON.stringify(LIVE_FILTER_BODY)

export const extractPublicJobs = (payload = {}) =>
  (Array.isArray(payload?.Result) ? payload.Result : [])
    .map((record) => {
      const title = normalizeWhitespace(record?.JobTitle)
      const location = extractPrimaryLocation(record?.Location)
      const sourceUrl = buildPublicJobUrl(normalizeWhitespace(record?.JobIdObfuscated))
      const orgId = normalizeWhitespace(record?.OrgDetails?.OrgID)
      const jobDescription = stripTags(record?.JobDescV2)

      if (!title || !location || !sourceUrl) return null
      if (!/\bindia\b/i.test(location)) return null
      if (orgId !== ORG_ID) return null

      return {
        title,
        company: COMPANY_NAME,
        department: normalizeWhitespace(record?.Department),
        location,
        city: extractCity(location),
        country: 'India',
        jobId: normalizeWhitespace(record?.JobId),
        requisitionId: normalizeWhitespace(record?.JobCode),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(record?.JobTypeV2) || null,
        experienceRequired: formatExperience(record?.Experience) || inferExperienceFromDescription(jobDescription),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(record?.Skills)
          ? record.Skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
          : [],
        postingDate: normalizeWhitespace(record?.PublishedDate),
        closingDate: normalizeWhitespace(record?.ExpiryDates?.CAREERPAGE),
        jobDescription,
        publicExperienceChecked: Boolean(jobDescription),
      }
    })
    .filter(Boolean)

export const createNaviScraper = (options = {}) => ({
  async run() {
    const { fetchPage, now = () => new Date().toISOString(), maxJobs = 10000, detailConcurrency = 2 } = options
    if (!Number.isSafeInteger(maxJobs) || maxJobs < 0 || maxJobs > 10000
      || !Number.isInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 3) throw Error('Navi invalid configured limits')
    options.signal?.throwIfAborted()
    if (maxJobs === 0) return attachInventoryEvidence([], { status: 'coverage-gap', surface: TURBOHIRE_BOARD_URL,
      firstParty: true, listingComplete: false, pagesFetched: 0, verifiedAt: now(), reason: 'caller-cap-zero-no-public-reads' })
    const transport = createPublicTurboHireTransport({ source: SOURCE, ...options,
      ...(fetchPage ? { fetchText: async (url, init) => {
        const page = await fetchPage(url, init)
        if (page.status !== 200 || !sameUrl(page.url, url)) throw Error('Navi verified public page status or final URL changed')
        return page.html
      } } : {}),
      allowedURL: (url, method, body) => method === 'GET'
        ? [CAREERS_PAGE_URL, TURBOHIRE_BOARD_URL, NOAUTH_TOKEN_URL].includes(url)||isReviewedNaviClientURL(url)
          || /^https:\/\/thapi-stage2\.azurewebsites\.net\/api\/publicjobs\?jobId=[A-Za-z0-9_%+-]{30,400}&fieldVisibility=None$/.test(url)
        : method === 'POST' && url === FILTERED_JOBS_URL && body === buildFilteredJobsRequestBody(),
    })
    const { fetchText, fetchScript, fetchJson, signal } = transport
    try {
      let currentClient
      const verifyPublisher = async () => {
        const corporate = await fetchText(CAREERS_PAGE_URL)
        if (!hasOfficialCareersPageSignal(corporate)) throw Error('Navi verified official careers page changed materially')
        if (!sameUrl(extractTurboHireHandoffUrl(corporate), TURBOHIRE_BOARD_URL)) throw Error('Navi verified official careers page no longer links to the verified TurboHire board')
        const boardHTML = await fetchText(TURBOHIRE_BOARD_URL)
        if (!hasOfficialBoardSignal(boardHTML)) throw Error('Navi verified TurboHire board changed materially')
        const client = await verifyNaviPublicClient({ boardHTML, fetchScript })
        if (currentClient && JSON.stringify(client) !== JSON.stringify(currentClient)) throw Error('Navi current public client changed during closing')
        currentClient = client
      }
      await verifyPublisher()
      const token = await fetchJson(NOAUTH_TOKEN_URL, { method: 'GET', headers: buildPublicHeaders() })
      if (typeof token?.access_token !== 'string' || !token.access_token) throw Error('Navi public anonymous token unavailable')
      const headers = buildPublicHeaders(token.access_token)
      const listingRequest = { method: 'POST', body: buildFilteredJobsRequestBody(),
        headers: { ...headers, 'Content-Type': 'application/json' }, signal }
      const payload = await fetchJson(FILTERED_JOBS_URL, listingRequest)
      validateNativeInventory(payload, { now: now() })
      const jobs = extractPublicJobs(payload).map(job => ({ ...job, source: SOURCE,
        link: job.applyUrl, scrapedAt: now() }))
      return await hydrateTurboHireJobs({ source: SOURCE, orgId: ORG_ID, employer: 'NAVI TECHNOLOGIES LIMITED',
        origin: ORIGIN, apiBaseUrl: API_BASE_URL, boardUrl: TURBOHIRE_BOARD_URL, payload, jobs,
        fetchJson, headers, listingUrl: FILTERED_JOBS_URL, listingRequest, maxJobs, signal, now,
        publicJobInfoUrl: listing => API_BASE_URL + '/api/publicjobs?jobId=' + listing.JobIdObfuscated + '&fieldVisibility=None',
        verifyNativeDetail: (detail, listing) => validateNativeDetail(detail, listing, { now: now() }),
        mapNativeFields: (detail, description) => ({ employmentType: normalizeWhitespace(detail.JobTypeV2),
          experienceRequired: formatExperience(detail.Experience) || inferExperienceFromDescription(description),
          requiredSkills: Array.isArray(detail.Skills) ? detail.Skills.filter(value => typeof value === 'string').map(normalizeWhitespace).filter(Boolean) : [] }),
        retainNativeProof: true, verifyPublisher,
        publisherProof: { corporateURL: CAREERS_PAGE_URL, boardURL: TURBOHIRE_BOARD_URL, orgId: ORG_ID, client: currentClient },
      })
    } finally { transport.close() }
  },
})

export const run = async (options = {}) => createNaviScraper(options).run()

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
