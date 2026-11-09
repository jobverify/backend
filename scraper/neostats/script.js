import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'neostats'
export const COMPANY = 'NeoStats'
export const HOMEPAGE_URL = 'https://neostats.ai/'
export const CAREERS_URL = 'https://neostats.ai/careers'
export const JOBS_API_URL = 'https://neostats.ai/api/careers/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(?:india|bangalore|bengaluru|chennai|hyderabad|pune|mumbai|gurgaon|gurugram|noida|delhi|new delhi|kolkata|calcutta|ahmedabad|kochi|cochin|coimbatore|mysore|mysuru|visakhapatnam|vizag|bhubaneswar|trivandrum|thiruvananthapuram)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const slugify = (...parts) => normalizeWhitespace(parts.filter(Boolean).join(' '))
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractCareersSection = (html) =>
  String(html ?? '').match(/<section[^>]+id=["']career-options["'][^>]*>[\s\S]*?<\/section>/i)?.[0] || ''

const extractTitle = (buttonHtml) =>
  stripTags(buttonHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null)

const extractMetadataSpans = (buttonHtml) =>
  [...String(buttonHtml ?? '').matchAll(
    /<span\b[^>]*class=["'][^"']*\bflex items-center gap-1\.5 text-xs\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
  )]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractRemoteStatus = (buttonHtml) =>
  stripTags(
    buttonHtml.match(
      /<span\b[^>]*class=["'][^"']*\brounded-full text-xs font-semibold\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    )?.[1] ?? null,
  )

const normalizeIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  return /india/i.test(location) ? location : `${location}, India`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const withoutCountry = normalized.replace(/,\s*India$/i, '')
  if (/\bor\b|\/|,/.test(withoutCountry)) return null

  return withoutCountry || null
}

const isIndiaLocation = (value) => INDIA_LOCATION_PATTERN.test(normalizeWhitespace(value) || '')

const buildJobDescription = ({
  department,
  location,
  experienceRequired,
  region,
  remoteStatus,
}) => [
  'Official NeoStats opening listed on the first-party careers page.',
  department ? `Department: ${department}.` : null,
  location ? `Location: ${location}.` : null,
  experienceRequired ? `Experience: ${experienceRequired}.` : null,
  region ? `Region: ${region}.` : null,
  remoteStatus ? `Work mode: ${remoteStatus}.` : null,
]
  .filter(Boolean)
  .join(' ')

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  return normalizeWhitespace(value)
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return /neostats\s*[—-]\s*win with intelligence/i.test(normalized)
    && normalized.includes('measurable business advantages')
    && /<a[^>]+href=["']\/careers["'][^>]*>\s*careers\s*<\/a>/i.test(String(html ?? ''))
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  const section = normalizeWhitespace(extractCareersSection(html))?.toLowerCase() || ''
  const hasScopeCopy = section.includes('positions across banking, data, cards & analytics transformations - globally')
    || section.includes('explore open roles across banking, data, cards & analytics transformations')
    || normalized.includes('explore open roles across data, analytics, risk, sales, and operations')

  return normalized.includes('careers | neostats')
    && section.includes('current openings')
    && section.includes('open roles')
    && hasScopeCopy
}

export const hasClientLoadedJobsSignal = (html) => {
  const page = String(html ?? '')

  return /<section[^>]+id=["']career-options["']/i.test(page)
    && (
      /\baria-busy=["']true["']/i.test(page)
      || /Loading open roles/i.test(page)
    )
}

export const extractOpenRoleCards = (html) => {
  const careersSection = extractCareersSection(html)
  if (!careersSection) return []

  const categoryMatches = [...careersSection.matchAll(
    /<div class="flex items-center gap-3 mb-3">[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>\s*<span[^>]*>\d+<\/span>/gi,
  )]

  const roles = []

  for (const [index, match] of categoryMatches.entries()) {
    const department = stripTags(match[1])
    const start = match.index ?? 0
    const end = index + 1 < categoryMatches.length
      ? categoryMatches[index + 1].index ?? careersSection.length
      : careersSection.length

    const categoryHtml = careersSection.slice(start, end)

    for (const buttonMatch of categoryHtml.matchAll(
      /<button\b[^>]*class=["'][^"']*\bw-full text-left\b[^"']*["'][^>]*>([\s\S]*?)<\/button>/gi,
    )) {
      const buttonHtml = buttonMatch[0]
      const title = extractTitle(buttonHtml)
      const [location, experienceRequired, region] = extractMetadataSpans(buttonHtml)
      const remoteStatus = extractRemoteStatus(buttonHtml)

      if (!title || !location) continue

      roles.push({
        title,
        department,
        location,
        experienceRequired: experienceRequired || null,
        region: region || null,
        remoteStatus: remoteStatus || null,
      })
    }
  }

  return roles
}

const buildIndiaJobsFromCards = (cards = []) =>
  cards
    .filter((card) => isIndiaLocation(card.location))
    .map((card) => {
      const location = normalizeIndiaLocation(card.location)
      const jobId = slugify(card.title, card.location)
      const remoteStatus = normalizeRemoteStatus(card.remoteStatus)

      return {
        title: card.title,
        company: COMPANY,
        department: card.department || null,
        location,
        city: extractCity(location),
        state: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        employmentType: null,
        experienceRequired: card.experienceRequired || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: buildJobDescription({
          department: card.department,
          location,
          experienceRequired: card.experienceRequired,
          region: card.region,
          remoteStatus,
        }),
        remoteStatus,
      }
    })

export const extractIndiaJobOpenings = (html) =>
  buildIndiaJobsFromCards(extractOpenRoleCards(html))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJobsApi = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })
  const body = await response.text()
  let json = null

  try {
    json = JSON.parse(body)
  } catch {
    json = null
  }

  return {
    status: response.status,
    url: response.url,
    body,
    json,
  }
}

export const hasUnavailableJobsApiResponse = ({ status, body, json } = {}) =>
  Number(status) >= 500
  && (
    /unable to load openings right now/i.test(String(body ?? ''))
    || /unable to load openings right now/i.test(String(json?.error ?? ''))
  )

export const extractIndiaJobsFromApi = (records, { now = () => new Date().toISOString() } = {}) => {
  if (!Array.isArray(records) || records.some((record) =>
    !normalizeWhitespace(record?.id)
    || !normalizeWhitespace(record?.slug)
    || !normalizeWhitespace(record?.title)
    || !normalizeWhitespace(record?.location)
  )) {
    throw new Error('Neostats jobs API payload changed materially')
  }

  const ids = records.map((record) => String(record.id))
  if (new Set(ids).size !== ids.length) {
    throw new Error('Neostats jobs API payload has duplicate role IDs')
  }

  return records.filter((record) => isIndiaLocation(record.location)).map((record) => {
    const location = normalizeIndiaLocation(record.location)
    const description = [
      normalizeWhitespace(record.about),
      ...(Array.isArray(record.responsibilities) ? record.responsibilities.map(normalizeWhitespace) : []),
      ...(Array.isArray(record.requirements) ? record.requirements.map(normalizeWhitespace) : []),
    ].filter(Boolean).join(' ')

    return {
      title: normalizeWhitespace(record.title),
      company: COMPANY,
      department: normalizeWhitespace(record.department),
      location,
      city: extractCity(location),
      state: null,
      country: 'India',
      jobId: String(record.id),
      requisitionId: String(record.id),
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: normalizeWhitespace(record.employmentType),
      experienceRequired: normalizeWhitespace(record.experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description || null,
      remoteStatus: normalizeRemoteStatus(record.mode),
      source: SOURCE,
      link: CAREERS_URL,
      scrapedAt: now(),
    }
  })
}

export const createNeostatsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJobsApi = defaultFetchJobsApi,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Neostats homepage no longer matches the verified official homepage')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Neostats careers page no longer matches the verified public careers page')
    }

    const roleCards = extractOpenRoleCards(careersHtml)
    if (roleCards.length === 0) {
      if (hasClientLoadedJobsSignal(careersHtml)) {
        const apiResult = await fetchJobsApi(JOBS_API_URL)
        if (hasUnavailableJobsApiResponse(apiResult)) {
          return attachInventoryEvidence([], {
            status: 'discovery-only',
            surface: JOBS_API_URL,
            firstParty: true,
            listingComplete: false,
            pagesFetched: 3,
            reportedTotal: null,
            indiaFacetCount: null,
            verifiedAt: now(),
            reason: 'Neostats jobs API is unavailable; preserving the existing job snapshot',
          })
        }

        if (Number(apiResult?.status) === 200) {
          return extractIndiaJobsFromApi(apiResult.json, { now })
        }
      }

      throw new Error('Neostats careers page no longer exposes verified public role cards')
    }

    return buildIndiaJobsFromCards(roleCards).map((job) => ({
      ...job,
      source: SOURCE,
      link: CAREERS_URL,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createNeostatsScraper().run(options)

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
