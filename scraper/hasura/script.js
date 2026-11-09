import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { HASURA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HASURA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const REDIRECTED_CAREERS_URL = PROVIDER_METADATA.redirectedCareersPageUrl
export const GEM_BOARD_URL = PROVIDER_METADATA.officialGemBoardUrl
export const GRAPHQL_URL = PROVIDER_METADATA.graphqlApiUrl
export const GEM_BOARD_BUNDLE_URL = PROVIDER_METADATA.gemBoardBundleUrl
export const GEM_BOARD_TRACKING_ID = PROVIDER_METADATA.gemBoardTrackingId
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const BOARD_ID = 'promptql'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const LIST_QUERY = `
query JobBoardList($boardId: String!) {
  oatsExternalJobPostings(boardId: $boardId) {
    jobPostings {
      id
      extId
      title
      locations {
        id
        name
        city
        isoCountry
        isRemote
        extId
      }
      job {
        id
        department {
          id
          name
          extId
        }
        locationType
        employmentType
      }
    }
  }
  oatsExternalJobPostingsFilters(boardId: $boardId) {
    type
    displayName
    rawValue
    value
    count
  }
  jobBoardExternal(vanityUrlPath: $boardId) {
    id
    teamDisplayName
    descriptionHtml
    pageTitle
  }
}
`

export const DETAIL_QUERY = `
query ExternalJobPostingQuery($boardId: String!, $extId: String!) {
  oatsExternalJobPosting(boardId: $boardId, extId: $extId) {
    id
    title
    descriptionHtml
    extId
    startDateTs
    firstPublishedTsSec
    companyLogo
    companyUrl
    isApplicationFormHidden
    isUnlistedExternally
    locations {
      id
      extId
      name
      city
      isoCountry
      isRemote
    }
    job {
      id
      locationType
      employmentType
      requisitionId
      teamDisplayName
      department {
        id
        extId
        name
      }
      locations {
        id
        extId
        name
        city
        isoCountry
        isRemote
      }
    }
    jobPostSectionHtml {
      introHtml
      outroHtml
    }
    compensationHtml
  }
}
`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&#x27;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchGraphql = async (body) => {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${GRAPHQL_URL}`)
  }

  return response.json()
}

export const hasOfficialCareersSignal = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return Number(page.status) === 200
    && normalizeUrl(page.url) === REDIRECTED_CAREERS_URL
    && normalized.includes('join us to build the future of reliable ai')
    && normalized.includes('see open roles')
    && normalized.includes('life at promptql')
    && rawHtml.includes(GEM_BOARD_URL)
}

export const hasOfficialGemBoardSignal = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return Number(page.status) === 200
    && normalizeUrl(page.url) === GEM_BOARD_URL
    && normalized.includes('promptql careers')
    && rawHtml.includes(GEM_BOARD_TRACKING_ID)
    && /https:\/\/static\.gem\.com\/scripts\/jobBoards\.[^"' ]+\.v2\.min\.js/i.test(rawHtml)
}

const hasValidPosting = (posting) =>
  posting
  && typeof posting.extId === 'string'
  && posting.extId.length > 0
  && typeof posting.title === 'string'
  && posting.title.length > 0
  && Array.isArray(posting.locations)

export const hasValidJobBoardListPayload = (payload) => {
  const postings = payload?.data?.oatsExternalJobPostings?.jobPostings
  const board = payload?.data?.jobBoardExternal

  return Array.isArray(postings)
    && postings.length > 0
    && postings.every(hasValidPosting)
    && typeof board?.pageTitle === 'string'
    && board.pageTitle === 'PromptQL Careers'
    && typeof board?.teamDisplayName === 'string'
    && /promptql/i.test(board.teamDisplayName)
}

export const isTalentCommunityPosting = (title) =>
  /\btalent community\b/i.test(String(title ?? ''))

const extractIndiaLocations = (locations = []) =>
  locations.filter((location) => location?.isoCountry === 'IND')

const dedupe = (values) => {
  const seen = new Set()
  const uniqueValues = []

  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    uniqueValues.push(value)
  }

  return uniqueValues
}

const toLocationLabel = (location) => {
  if (location?.isRemote) return 'Remote, India'

  const normalizedCity = normalizeCity(location?.city || location?.name || '')
  if (normalizedCity && normalizedCity.toLowerCase() !== 'india') {
    return `${normalizedCity}, India`
  }

  return 'India'
}

const getPrimaryCity = (locations) => {
  for (const location of locations) {
    if (location?.isRemote) continue

    const city = normalizeCity(location?.city || location?.name || '')
    if (city && city.toLowerCase() !== 'india') {
      return city
    }
  }

  const fallback = locations.find((location) => location?.city || location?.name)
  if (!fallback) return null

  const normalized = normalizeCity(fallback.city || fallback.name)
  return normalized && normalized.toLowerCase() !== 'india' ? normalized : null
}

const mapEmploymentType = (value) => {
  if (value === 'FULL_TIME') return 'Full-time'
  if (!value) return null

  return value
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('-')
}

const hasValidJobDetailPayload = (payload, expectedExtId) => {
  const posting = payload?.data?.oatsExternalJobPosting

  return posting
    && typeof posting.title === 'string'
    && posting.title.length > 0
    && typeof posting.extId === 'string'
    && posting.extId === expectedExtId
    && typeof posting.descriptionHtml === 'string'
    && Array.isArray(posting.locations)
}

export const toJobDetailUrl = (extId) => `${GEM_BOARD_URL}/${encodeURIComponent(extId)}`

export const toApplyUrl = (extId) => `${toJobDetailUrl(extId)}/application`

export const extractIndiaJobStubs = (payload) => {
  const postings = payload?.data?.oatsExternalJobPostings?.jobPostings
  if (!Array.isArray(postings)) return []

  return postings
    .map((posting) => {
      if (isTalentCommunityPosting(posting.title)) return null

      const indiaLocations = extractIndiaLocations(posting.locations)
      if (!indiaLocations.length) return null

      return {
        title: posting.title,
        extId: posting.extId,
        department: posting.job?.department?.name ?? null,
        indiaLocations,
      }
    })
    .filter(Boolean)
}

export const buildJobFromDetail = (stub, detailPayload) => {
  if (!hasValidJobDetailPayload(detailPayload, stub?.extId)) {
    throw new Error(`Hasura job detail payload no longer matches the verified Gem contract for ${stub?.extId ?? 'unknown job'}`)
  }

  const posting = detailPayload.data.oatsExternalJobPosting
  const indiaLocations = extractIndiaLocations(posting.locations)
  const location = dedupe(indiaLocations.map((item) => toLocationLabel(item))).join('; ')
  const city = getPrimaryCity(indiaLocations)
  const postingDate = Number.isFinite(posting.firstPublishedTsSec)
    ? new Date(posting.firstPublishedTsSec * 1000).toISOString()
    : null

  return {
    title: posting.title,
    company: COMPANY,
    department: posting.job?.department?.name ?? stub.department ?? null,
    location,
    city,
    country: 'India',
    jobId: posting.extId,
    requisitionId: posting.job?.requisitionId ?? null,
    sourceUrl: toJobDetailUrl(posting.extId),
    applyUrl: toApplyUrl(posting.extId),
    employmentType: mapEmploymentType(posting.job?.employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    jobDescription: normalizeWhitespace(posting.descriptionHtml),
    remoteStatus:
      posting.job?.locationType === 'REMOTE' || indiaLocations.some((location) => location?.isRemote)
        ? 'Remote'
        : 'On-site',
  }
}

const buildListRequestBody = () => ({
  operationName: 'JobBoardList',
  query: LIST_QUERY,
  variables: {
    boardId: BOARD_ID,
  },
})

const buildDetailRequestBody = (extId) => ({
  operationName: 'ExternalJobPostingQuery',
  query: DETAIL_QUERY,
  variables: {
    boardId: BOARD_ID,
    extId,
  },
})

const decorateJob = (job, scrapedAt) => ({
  ...job,
  link: job.applyUrl,
  source: SOURCE,
  companyCareerPage: CAREERS_URL,
  companyDomain: PROVIDER_METADATA.companyDomain,
  atsPlatform: PROVIDER_METADATA.atsPlatform,
  scrapedAt,
})

export const createHasuraScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchGraphql = defaultFetchGraphql,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersPage)) {
      throw new Error('Hasura careers redirect surface no longer matches the verified first-party PromptQL handoff')
    }

    const gemBoardPage = await fetchPage(GEM_BOARD_URL)
    if (!hasOfficialGemBoardSignal(gemBoardPage)) {
      throw new Error('Hasura Gem board shell no longer matches the verified public board surface')
    }

    const listPayload = await fetchGraphql(buildListRequestBody())
    if (!hasValidJobBoardListPayload(listPayload)) {
      throw new Error('Hasura public job board list payload no longer matches the verified Gem contract')
    }

    const stubs = extractIndiaJobStubs(listPayload)
    const jobs = []

    for (const stub of stubs) {
      const detailPayload = await fetchGraphql(buildDetailRequestBody(stub.extId))
      jobs.push(buildJobFromDetail(stub, detailPayload))
    }

    const scrapedAt = now()

    return jobs
      .sort((left, right) => {
        const leftTime = left.postingDate ? Date.parse(left.postingDate) : 0
        const rightTime = right.postingDate ? Date.parse(right.postingDate) : 0
        return rightTime - leftTime
      })
      .map((job) => decorateJob(job, scrapedAt))
  },
})

export const run = async (options = {}) => createHasuraScraper().run(options)

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
