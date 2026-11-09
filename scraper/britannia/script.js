import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { hydrateTurboHireJobs } from '../../scraper-support/utils/turboHireDetails.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createPublicTurboHireTransport } from '../../scraper-support/utils/turboHirePublicTransport.js'
import { TURBOHIRE_CURRENT_PUBLIC_CLIENT } from '../../scraper-support/utils/turboHirePublicClient.js'
import { isReviewedBritanniaClientURL, verifyBritanniaPublicClient } from './publicClient.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const OFFICIAL_CAREERS_URL = 'https://www.britannia.co.in/careers'
export const ORIGIN = 'https://britannia.turbohire.co'
export const ORG_ID = 'c143932d-0df7-4856-9dc5-0a9f1ca26dc5'
export const BOARD_URL = `${ORIGIN}/careerpage/${ORG_ID}`
export const API_BASE_URL = TURBOHIRE_CURRENT_PUBLIC_CLIENT.apiBaseURL
export const NOAUTH_TOKEN_URL = `${API_BASE_URL}/api/token/noauth`
export const FILTERED_JOBS_URL = `${API_BASE_URL}/api/careerpagev2/filteredjobs?orgId=${ORG_ID}&pageType=0`

const DEFAULT_HEADERS = {
  Origin: ORIGIN,
  Referer: BOARD_URL,
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json, text/plain, */*',
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
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
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

const parseLocations = (value) => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const normalizeLocation = (value) => normalizeWhitespace(value)?.replace(/\s*,\s*/g, ', ') || null

const extractCity = (location) => normalizeLocation(location)?.split(',')[0] || null

const isIndiaLocation = (location) => /(?:^|,\s*)india$/i.test(normalizeWhitespace(location) || '')

const buildPublicJobUrl = (jobIdObfuscated) => (
  jobIdObfuscated
    ? `${ORIGIN}/job/publicjobs/${jobIdObfuscated}`
    : null
)

const buildAuthenticatedHeaders = (accessToken = null) => {
  const headers = { ...DEFAULT_HEADERS }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return headers
}

export const hasOfficialCareersSignal = (html) => {
  const doc = readNativeDocument(String(html ?? ''))
  return doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical' && n.attrs.href === OFFICIAL_CAREERS_URL).length === 1
    && doc.nodes(n => n.tag === 'title' && /Explore Britannia Careers: Exciting Job Opportunities Await/i.test(n.raw || '')).length === 1
    && doc.nodes(n => n.tag === 'h1' && doc.text(n) === 'WE GROW WHEN OUR PEOPLE GROW').length === 1
}

export const extractTurboHireHandoffUrl = (html) => {
  const doc = readNativeDocument(String(html ?? ''))
  return doc.nodes(n => n.tag === 'a' && n.attrs.href === BOARD_URL).length ? BOARD_URL : null
}

export const hasOfficialBoardSignal = (html) => {
  const doc = readNativeDocument(String(html ?? ''))
  return doc.nodes(n => n.tag === 'title' && n.raw?.trim() === 'Britannia Industries').length === 1
    && doc.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:title' && n.attrs.content === 'Britannia Industries - Career Page').length === 1
    && doc.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:site_name' && n.attrs.content === 'Britannia Industries').length === 1
  }

export const extractPublicJobs = (payload = {}) =>
  (Array.isArray(payload?.Result) ? payload.Result : [])
    .map((record) => {
      const title = normalizeWhitespace(record?.JobTitle)
      const location = parseLocations(record?.Location).map(place => normalizeLocation(place?.Address)).find(isIndiaLocation)
      const sourceUrl = buildPublicJobUrl(normalizeWhitespace(record?.JobIdObfuscated))

      if (!title || !location || !sourceUrl || !isIndiaLocation(location)) return null

      return {
        title,
        company: normalizeWhitespace(record?.OrgDetails?.OrgName) || 'Britannia Industries',
        department: normalizeWhitespace(record?.Department),
        location,
        city: extractCity(location),
        country: 'India',
        jobId: normalizeWhitespace(record?.JobId),
        requisitionId: normalizeWhitespace(record?.JobCode),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(record?.JobTypeV2) || null,
        experienceRequired: formatExperience(record?.Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(record?.Skills)
          ? record.Skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
          : [],
        postingDate: normalizeWhitespace(record?.PublishedDate),
        closingDate: normalizeWhitespace(record?.ExpiryDates?.CAREERPAGE),
        jobDescription: stripTags(record?.JobDescV2),
      }
    })
    .filter(Boolean)

export const createBritanniaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const now = options.now || (() => new Date().toISOString())
    const cap = options.maxJobs ?? maxJobs
    if (cap != null && (!Number.isSafeInteger(cap) || cap < 0)) throw Error('Britannia invalid caller cap')
    options.signal?.throwIfAborted()
    if (cap === 0) return attachInventoryEvidence([], { status: 'coverage-gap', surface: BOARD_URL,
      firstParty: true, listingComplete: false, pagesFetched: 0, verifiedAt: now(), reason: 'caller-cap-zero-no-public-reads' })
    const transport = createPublicTurboHireTransport({ source: 'britannia', ...options,
      allowedURL: (url, method, body) => method === 'GET'
        ? [OFFICIAL_CAREERS_URL, BOARD_URL, NOAUTH_TOKEN_URL].includes(url) || isReviewedBritanniaClientURL(url)
          || /^https:\/\/thapi-stage2\.azurewebsites\.net\/api\/publicjobs\/[0-9a-f-]{36}\?fieldVisibility=CareerPage$/i.test(url)
        : method === 'POST' && url === FILTERED_JOBS_URL && body === '{}',
    })
    const { fetchText, fetchScript, fetchJson, signal } = transport
    try {
      let currentClient
      const verifyPublisher = async () => {
        const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)
        if (!hasOfficialCareersSignal(careersHtml)) {
          throw new Error('Britannia official careers page no longer matches the verified public surface')
        }

        const handoffUrl = extractTurboHireHandoffUrl(careersHtml)
        if (handoffUrl !== BOARD_URL) {
          throw new Error('Britannia official careers page no longer exposes the verified TurboHire handoff')
        }

        const boardHtml = await fetchText(BOARD_URL)
        if (!hasOfficialBoardSignal(boardHtml)) {
          throw new Error('The official Britannia TurboHire board no longer matches the verified public surface')
        }
        const client = await verifyBritanniaPublicClient({ boardHTML: boardHtml, fetchScript })
        if (currentClient && JSON.stringify(client) !== JSON.stringify(currentClient)) throw Error('Britannia current public client changed during closing')
        currentClient = client
      }
      await verifyPublisher()

      const tokenPayload = await fetchJson(NOAUTH_TOKEN_URL, {
        method: 'GET',
        headers: buildAuthenticatedHeaders(),
      })

      if (typeof tokenPayload?.access_token !== 'string' || !tokenPayload.access_token) throw Error('Britannia public anonymous token unavailable')
      const listingRequest = {
        method: 'POST',
        headers: {
          ...buildAuthenticatedHeaders(tokenPayload?.access_token),
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal,
      }
      const listingsPayload = await fetchJson(FILTERED_JOBS_URL, listingRequest)

      const jobs = extractPublicJobs(listingsPayload).map((job) => ({
        ...job,
        source: 'britannia',
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))

      return await hydrateTurboHireJobs({ source: 'britannia', orgId: ORG_ID, employer: 'Britannia Industries',
        origin: ORIGIN, apiBaseUrl: API_BASE_URL, boardUrl: BOARD_URL, payload: listingsPayload, jobs,
        fetchJson, headers: buildAuthenticatedHeaders(tokenPayload.access_token), listingUrl: FILTERED_JOBS_URL,
        listingRequest, maxJobs: cap, signal, now, retainNativeProof: true,
        mapNativeFields: detail => ({ employmentType: normalizeWhitespace(detail.JobTypeV2),
          experienceRequired: formatExperience(detail.Experience),
          requiredSkills: Array.isArray(detail.Skills) ? detail.Skills.filter(value => typeof value === 'string').map(normalizeWhitespace).filter(Boolean) : [] }),
        publisherProof: { corporateURL: OFFICIAL_CAREERS_URL, boardURL: BOARD_URL, orgId: ORG_ID, client: currentClient }, verifyPublisher,
      })
    } finally { transport.close() }
  },
})

export const run = async (options = {}) => createBritanniaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Britannia scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'britannia')
    console.log('DB result:', result)
    process.exit(0)
  }
}
