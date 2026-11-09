import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'corover'
export const COMPANY = 'CoRover'
export const VERIFIED_ON = '2026-07-30'
export const CAREERS_URL = 'https://corover.ai/company/careers'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const INDIA_LOCATION_HINTS = [
  'india',
  'bangalore',
  'bengaluru',
  'new delhi',
  'mumbai',
  'pune',
  'hyderabad',
  'chennai',
  'gurgaon',
  'gurugram',
  'noida',
  'kolkata',
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value = '') =>
  normalizeWhitespace(
    decodeEntities(String(value))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const extractTextLines = (html = '') =>
  decodeEntities(String(html))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(\/?(?:div|p|span|h[1-6]|section|article|li|ul|ol|a))\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableText = (value) =>
  normalizeWhitespace(value)?.toLowerCase().replace(/[^a-z0-9]+/g, ' ')?.trim() || ''

const titlesMatch = (left, right) =>
  Boolean(normalizeComparableText(left) && normalizeComparableText(left) === normalizeComparableText(right))

const extractHeroText = (html = '') =>
  stripTags(
    String(html).match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '',
  )

const extractH1 = (html = '') =>
  stripTags(String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')

const extractSectionBetweenLines = (lines = [], startLabel, endLabels = []) => {
  const normalizedStart = normalizeComparableText(startLabel)
  const normalizedEnds = new Set(endLabels.map((value) => normalizeComparableText(value)))
  const startIndex = lines.findIndex((line) => normalizeComparableText(line) === normalizedStart)

  if (startIndex < 0) return null

  const values = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const normalizedLine = normalizeComparableText(lines[index])
    if (normalizedEnds.has(normalizedLine)) break
    values.push(lines[index])
  }

  return values.length > 0 ? values.join(' ') : null
}

const extractValueAfterLabel = (lines = [], label) => {
  const normalizedLabel = normalizeComparableText(label)
  const index = lines.findIndex((line) => normalizeComparableText(line) === normalizedLabel)
  if (index < 0) return null
  return lines[index + 1] || null
}

const normalizeDatePosted = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return null

  const monthByName = {
    jan: '01',
    january: '01',
    feb: '02',
    february: '02',
    mar: '03',
    march: '03',
    apr: '04',
    april: '04',
    may: '05',
    jun: '06',
    june: '06',
    jul: '07',
    july: '07',
    aug: '08',
    august: '08',
    sep: '09',
    sept: '09',
    september: '09',
    oct: '10',
    october: '10',
    nov: '11',
    november: '11',
    dec: '12',
    december: '12',
  }

  const month = monthByName[match[2].toLowerCase()]
  if (!month) return null

  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bIndia\b/i.test(normalized) || /;\s*.+-\s*(?:UK|US)\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return false
  return INDIA_LOCATION_HINTS.some((hint) => normalized.includes(hint))
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const firstSegment = normalized.split(';')[0]?.trim() || normalized
  const firstPart = firstSegment.split(',')[0]?.trim() || firstSegment
  return firstPart.replace(/\s*-\s*india$/i, '').trim() || null
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('on-site') || normalized.includes('onsite')) return 'On-site'
  return normalizeWhitespace(value)
}

const joinDescriptionParts = (...parts) => {
  const seen = new Set()
  const values = []

  for (const part of parts) {
    const normalized = normalizeWhitespace(part)
    if (!normalized) continue

    const comparable = normalized.toLowerCase()
    if (seen.has(comparable)) continue
    seen.add(comparable)
    values.push(normalized)
  }

  return values.join(' ') || null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*Careers\s*\|\s*CoRover\s*<\/title>/i.test(page)
    && text.includes('Careers at CoRover')
    && text.includes('Join Our Mission')
    && text.includes('A glimpse of our recent offsite in GOA!')
    && /href="\/company\/careers\/[^"/?#]+"/i.test(page)
    && /Apply Now/i.test(text)
}

export const hasOfficialDetailPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>[\s\S]+?\|\s*Careers at CoRover\s*<\/title>/i.test(page)
    && /\bJob Overview\b/i.test(text)
    && /\bApply for this Position\b/i.test(text)
    && /\bCoRover\b/i.test(text)
}

export const extractListingCards = (html = '', baseUrl = CAREERS_URL) => {
  const listings = []
  const pattern = /<a[^>]+href="([^"]*\/company\/careers\/[^"/?#]+)"[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const detailUrl = toAbsoluteUrl(match[1], baseUrl)
    const lines = extractTextLines(match[2])

    if (!detailUrl || !lines.some((line) => /apply now/i.test(line))) continue

    const cleaned = lines
      .filter((line) => !/apply now/i.test(line))
      .filter((line) => !/^\d{2}$/.test(line))

    const title = cleaned.find((line) => !/^(full-time|part-time|contract|internship)$/i.test(line)
      && !/^\d{1,2}\s+[a-z]{3,9}\s+\d{4}$/i.test(line)
      && !isIndiaLocation(line)
      && !/mission|careers at corover/i.test(line)
      && line !== cleaned[0]) || cleaned[1] || null

    const department = cleaned[0] || null
    const location = cleaned.find((line) => isIndiaLocation(line)) || null
    const employmentType = cleaned.find((line) => /^(full-time|part-time|contract|internship)$/i.test(line)) || null
    const postedDate = cleaned.find((line) => /^\d{1,2}\s+[a-z]{3,9}\s+\d{4}$/i.test(line)) || null

    if (!detailUrl || !department || !title || !location || !employmentType || !postedDate) continue

    listings.push({
      detailUrl,
      slug: detailUrl.split('/').filter(Boolean).at(-1) || null,
      department,
      title,
      location,
      employmentType,
      postedDate,
    })
  }

  return listings
}

const buildMappedJob = ({
  listing,
  detailHtml,
  scrapedAt,
}) => {
  const detailLines = extractTextLines(detailHtml)
  const detailTitle = extractH1(detailHtml) || listing.title
  const department = extractValueAfterLabel(detailLines, 'Department') || detailLines[0] || listing.department
  const location = extractValueAfterLabel(detailLines, 'Location') || listing.location
  const jobType = extractValueAfterLabel(detailLines, 'Job Type') || listing.employmentType
  const workMode = extractValueAfterLabel(detailLines, 'Work Mode')
  const experience = extractValueAfterLabel(detailLines, 'Experience')
  const postedDate = extractValueAfterLabel(detailLines, 'Date Posted') || listing.postedDate

  if (!titlesMatch(detailTitle, listing.title)) {
    throw new Error('CoRover verified detail page title no longer matches the listing card')
  }

  if (!department || !location || !jobType || !postedDate) {
    throw new Error('CoRover verified detail page no longer exposes the trusted public job overview')
  }

  const normalizedLocation = normalizeLocation(location)
  if (!normalizedLocation || !isIndiaLocation(normalizedLocation)) return null

  const description = joinDescriptionParts(
    extractHeroText(detailHtml),
    extractSectionBetweenLines(
      detailLines,
      'Job Description',
      ['Required Skills & Qualifications', 'Job Overview', 'Apply for this Position'],
    ),
  ) || 'Apply via the CoRover careers page.'

  return {
    title: detailTitle,
    company: COMPANY,
    department,
    location: normalizedLocation,
    city: extractCity(normalizedLocation),
    country: 'India',
    link: listing.detailUrl,
    applyUrl: listing.detailUrl,
    sourceUrl: listing.detailUrl,
    source: SOURCE,
    jobId: listing.slug,
    requisitionId: listing.slug,
    employmentType: jobType,
    experienceRequired: experience,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDatePosted(postedDate),
    closingDate: null,
    jobDescription: description,
    remoteStatus: normalizeRemoteStatus(workMode),
    scrapedAt,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const createCoRoverScraper = ({ maxJobs = null } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error(
        'CoRover verified official careers page no longer matches the trusted public jobs surface',
      )
    }

    const listings = extractListingCards(careersHtml, CAREERS_URL)
    if (listings.length === 0) {
      throw new Error('CoRover careers page no longer exposes the verified public job cards')
    }

    const jobs = []
    const scrapedAt = now()

    for (const listing of listings) {
      if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break

      const detailHtml = await fetchText(listing.detailUrl)
      if (!hasOfficialDetailPageSignal(detailHtml)) {
        throw new Error(
          'CoRover verified detail page no longer matches the trusted public jobs surface',
        )
      }

      const job = buildMappedJob({
        listing,
        detailHtml,
        scrapedAt,
      })

      if (!job) continue
      jobs.push(job)
    }

    if (jobs.length === 0) {
      throw new Error('CoRover careers page returned no public India jobs')
    }

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createCoRoverScraper(options).run(options)
