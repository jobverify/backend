import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SYLLABLE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SYLLABLE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_URL = PROVIDER_METADATA.linkedJobsBoardUrl
export const JOB_BOARD_SLUG = PROVIDER_METADATA.linkedJobsBoardSlug
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(value)

const toAbsoluteUrl = (value, baseUrl = JOBS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const getLastPathSegment = (value) => {
  try {
    const { pathname } = new URL(value)
    const parts = pathname.split('/').filter(Boolean)
    return parts.at(-1) ?? null
  } catch {
    return null
  }
}

const isIndiaLocation = (value) => /(?:^|[^a-z])(india|in)(?:[^a-z]|$)/i.test(String(value ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const hasVerifiedBoardLink = /href=["']https:\/\/ats\.rippling\.com\/syllable-corporation\/jobs["']/i.test(page)

  return normalized.includes('Careers at Syllable AI - AI Infrastructure & Agent Platform')
    && normalized.includes('Build the Future of AI Infrastructure')
    && normalized.includes('Open Positions')
    && normalized.includes('View Open Positions')
    && hasVerifiedBoardLink
  }

export const extractVerifiedJobBoardUrl = (html = '') => {
  if (!hasVerifiedCareersPageSignal(html)) {
    throw new Error('Syllable verified first-party careers page no longer matches the trusted surface')
  }

  const matches = [...String(html ?? '').matchAll(/href=["'](https:\/\/ats\.rippling\.com\/syllable-corporation\/jobs(?:[^"']*)?)["']/gi)]
  const verifiedUrl = matches
    .map((match) => toAbsoluteUrl(match[1], CAREERS_URL))
    .find((url) => url === JOBS_URL)

  if (!verifiedUrl) {
    throw new Error('Syllable first-party careers page no longer links to the verified Rippling board')
  }

  return verifiedUrl
}

const hasVerifiedEmptyBoard = (html) => {
  const raw = String(html ?? '').match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]
  if (!raw) return false
  try {
    const data = JSON.parse(raw)
    const props = data.props?.pageProps
    const board = props?.apiData?.jobBoard
    const query = props?.dehydratedState?.queries?.find(item => item.queryKey?.[0] === 'board' && item.queryKey?.[1] === JOB_BOARD_SLUG && item.queryKey?.[2] === 'job-posts')
    const filter = query?.queryKey?.[4]
    const jobs = query?.state?.data
    return board?.slug === JOB_BOARD_SLUG
      && board.companyName === 'Syllable Corporation'
      && board.boardURL === JOBS_URL
      && props.apiData.jobBoardSlug === JOB_BOARD_SLUG
      && data.query?.jobBoardSlug === JOB_BOARD_SLUG
      && query.state.status === 'success' && query.state.error === null
      && filter?.searchQuery === '' && Array.isArray(filter.departments) && filter.departments.length === 0
      && filter.workplaceType === null && filter.country === '' && filter.state === '' && filter.city === '' && filter.page === 0
      && Array.isArray(jobs?.items) && jobs.items.length === 0
      && jobs.page === 0 && jobs.totalItems === 0 && jobs.totalPages === 0
  } catch { return false }
}

export const hasVerifiedBoardPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html) || ''

  return /<title\b[^>]*>\s*Syllable Corporation(?:\s+Jobs)?\s*<\/title>/i.test(page)
    && normalized.includes('Syllable Corporation')
    && (normalized.includes('View job') || (normalized.includes('There are currently no open roles.') && hasVerifiedEmptyBoard(page)))
    && normalized.includes('Powered by Rippling')
  }

export const extractListingCards = (html = '') => {
  const page = String(html ?? '')

  if (!hasVerifiedBoardPageSignal(page)) {
    throw new Error('Syllable verified Rippling board no longer matches the trusted listing surface')
  }

  const cards = []
  const seenUrls = new Set()
  const articleSegments = page.match(/<article\b[\s\S]*?<\/article>/gi) ?? []

  for (const segment of articleSegments) {
    const matches = [...segment.matchAll(/href=["']([^"']*\/syllable-corporation\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    const primaryMatch = matches.find((match) => !/view job/i.test(stripHtml(match[2]) ?? '')) ?? matches[0]
    const detailUrl = primaryMatch?.[1] ? toAbsoluteUrl(primaryMatch[1], JOBS_URL) : null
    const title = primaryMatch?.[2] ? stripHtml(primaryMatch[2]) : null
    const department = stripHtml(segment.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    const locationSummary = stripHtml(segment.match(/class=["']location-summary["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const locationShort = stripHtml(segment.match(/class=["']location-short["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])

    if (!detailUrl || !title || seenUrls.has(detailUrl)) continue

    seenUrls.add(detailUrl)
    cards.push({
      title,
      department,
      locationSummary,
      locationShort,
      detailUrl,
    })
  }

  if (cards.length > 0) return cards

  for (const match of page.matchAll(/href=["']([^"']*\/syllable-corporation\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const detailUrl = toAbsoluteUrl(match[1], JOBS_URL)
    const title = stripHtml(match[2])
    if (!detailUrl || !title || /view job/i.test(title) || seenUrls.has(detailUrl)) continue

    seenUrls.add(detailUrl)
    cards.push({
      title,
      department: null,
      locationSummary: null,
      locationShort: null,
      detailUrl,
    })
  }

  if (cards.length === 0 && !hasVerifiedEmptyBoard(page)) {
    throw new Error('Syllable verified Rippling listings are missing without a trusted zero-role payload')
  }
  return cards
}

export const extractJobDetail = (html = '', detailUrl) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  if (!normalized.includes('Syllable Corporation') || !normalized.includes('Apply now') || !normalized.includes('HR@syllable.ai')) {
    throw new Error('Syllable verified Rippling job detail no longer matches the trusted public surface')
  }

  const paragraphs = [...page.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
  const title = stripHtml(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
    || stripHtml(page.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1])
    || paragraphs.find((value) =>
      value
      && value !== 'Syllable Corporation'
      && value !== 'A1000 ActiumHealth'
      && !/^\(/.test(value)
      && !/^Remote \(/i.test(value)
      && !/^[A-Za-z .'-]+,\s*[A-Z]{2}$/i.test(value)
      && !/^Share on:/i.test(value))
    || null
  const department = paragraphs.find((value) => value === 'A1000 ActiumHealth') || null
  const location = paragraphs.find((value) => /^Remote \(/i.test(value)) || null
  const locationShort = paragraphs.find((value) => /^[A-Za-z .'-]+,\s*[A-Z]{2}$/i.test(value)) || null
  const city = locationShort ? locationShort.split(',')[0].trim() : null
  const employmentType = /^Remote \(/i.test(location ?? '') ? 'Remote' : 'On-site'
  const country = isIndiaLocation(location) ? 'India' : 'United States'
  const descriptionStartIndex = paragraphs.findIndex((value) =>
    /^\(Syllable Corporation has an opening/i.test(value) || /^Responsible for /i.test(value))
  const descriptionEndIndex = paragraphs.findIndex((value) =>
    value === department || value === locationShort || value === location || /^Share on:/i.test(value))
  const fallbackDescription = descriptionStartIndex >= 0
    ? normalizeWhitespace(
        paragraphs
          .slice(
            descriptionStartIndex,
            descriptionEndIndex > descriptionStartIndex ? descriptionEndIndex : paragraphs.length,
          )
          .join(' '),
      )
    : null
  const description = stripHtml(page.match(/<div class=["']description["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]) || fallbackDescription
  const rawId = getLastPathSegment(detailUrl)
  const jobId = rawId ? `syllable-${rawId}` : null

  if (!title || !location || !description || !jobId) {
    throw new Error('Syllable verified Rippling job detail no longer matches the trusted public surface')
  }

  return {
    title,
    department,
    location,
    city,
    country,
    employmentType,
    jobId,
    jobDescription: description,
    detailUrl,
  }
}

export const createSyllableScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const verifiedBoardUrl = extractVerifiedJobBoardUrl(careersHtml)
    const boardHtml = await fetchText(verifiedBoardUrl)
    const listings = extractListingCards(boardHtml)

    const jobs = []
    for (const listing of listings) {
      const detail = extractJobDetail(await fetchText(listing.detailUrl), listing.detailUrl)
      if (!isIndiaLocation(detail.location)) continue

      jobs.push({
        title: detail.title,
        company: COMPANY_NAME,
        department: detail.department,
        location: detail.location,
        city: detail.city,
        state: null,
        country: 'India',
        jobId: detail.jobId,
        requisitionId: detail.jobId,
        sourceUrl: detail.detailUrl,
        applyUrl: detail.detailUrl,
        employmentType: detail.employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: detail.jobDescription,
        remoteStatus: detail.employmentType,
        source: SOURCE,
        link: detail.detailUrl,
        scrapedAt: now(),
      })
    }

    if (hasVerifiedEmptyBoard(boardHtml)) {
      return attachInventoryEvidence(jobs, {
        status: 'verified-empty', surface: verifiedBoardUrl, firstParty: true, listingComplete: true,
        pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0, verifiedAt: now(),
        reason: 'exact-rippling-board-unfiltered-successful-zero-role-payload',
      })
    }
    return jobs
  },
})

export const run = async (options = {}) => createSyllableScraper(options).run(options)

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
