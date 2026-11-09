export const CAREERS_URL = 'https://ymri.yamaha-motor-india.com/job-career.html'
export const APPLY_FORM_URL = 'https://ymri.yamaha-motor-india.com/job-quickapply.html'

const COMPANY = 'Yamaha Motor Research and Development India'
const SOURCE = 'yamaha'
const DEFAULT_MAX_PAGES = 10
const GENERIC_ANCHOR_LABELS = new Set([
  'home',
  'about',
  'functions',
  'career',
  'contact',
  'apply now',
  'apply',
  'image',
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

const resolveUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/india$/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  if (/chennai/i.test(normalized)) return 'Chennai'
  if (/surajpur/i.test(normalized)) return 'Surajpur'
  if (/noida/i.test(normalized)) return 'Noida'

  const base = normalized
    .replace(/,\s*India$/i, '')
    .replace(/\s+Plant$/i, '')
    .split(',')[0]

  return toTitleCase(base)
}

const extractDepartmentFromTitle = (title) => {
  const parts = normalizeWhitespace(title)?.split(/\s+-\s+/) || []
  if (parts.length < 2) return null
  return normalizeWhitespace(parts.slice(1).join(' - '))
}

const extractAnchors = (html) => [...String(html ?? '').matchAll(
  /<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => ({
    index: match.index ?? 0,
    href: normalizeWhitespace(match[2]),
    text: stripTags(match[3]),
  }))
  .filter((anchor) => anchor.href && anchor.text)

const getRelevantCareersSection = (html) => {
  const page = String(html ?? '')
  const sectionStart = page.search(/Rev\s+Your\s+Career\s+in\s+YMRI/i)
  const relevantPage = sectionStart >= 0 ? page.slice(sectionStart) : page
  const contactIndex = relevantPage.search(/Contact Information/i)
  return contactIndex >= 0 ? relevantPage.slice(0, contactIndex) : relevantPage
}

const looksLikeJobTitleAnchor = (anchor, relevantPage) => {
  const label = normalizeWhitespace(anchor.text)?.toLowerCase()
  if (!label || GENERIC_ANCHOR_LABELS.has(label)) return false

  const snippet = stripTags(relevantPage.slice(anchor.index, anchor.index + 500)) || ''
  return /experience\s*:/i.test(snippet) && /location\s*:/i.test(snippet)
}

const extractExperience = (text) =>
  normalizeWhitespace(
    text.match(/Experience\s*:\s*([^|]+?)(?=\s*\|\s*Location\s*:|$)/i)?.[1]
      || text.match(/Experience\s*:\s*([\s\S]*?)(?=Location\s*:|$)/i)?.[1],
  )

const extractLocationValue = (text) =>
  normalizeWhitespace(text.match(/Location\s*:\s*([^\n\r|]+?)(?=\s+Apply\b|$)/i)?.[1])

export const hasOfficialCareersSignal = (html) => {
  const page = stripTags(html)?.toLowerCase() || ''

  return page.includes('rev your career in ymri')
    && page.includes('ymri career page')
    && page.includes('by experience')
    && page.includes('by location')
}

export const extractJobCards = (html) => {
  const relevantPage = getRelevantCareersSection(html)
  const anchors = extractAnchors(relevantPage)
  const titleAnchors = anchors.filter((anchor) => looksLikeJobTitleAnchor(anchor, relevantPage))

  return titleAnchors.map((titleAnchor, index) => {
    const nextAnchorIndex = titleAnchors[index + 1]?.index ?? relevantPage.length
    const segment = relevantPage.slice(titleAnchor.index, nextAnchorIndex)
    const segmentText = stripTags(segment) || ''
    const segmentAnchors = extractAnchors(segment)
    const applyAnchor = segmentAnchors.find((anchor) => /^apply$/i.test(anchor.text))
    const sourceUrl = resolveUrl(applyAnchor?.href || titleAnchor.href)
    const title = normalizeWhitespace(titleAnchor.text)
    const location = normalizeLocation(extractLocationValue(segmentText))
    const city = extractCity(location)
    const experienceRequired = extractExperience(segmentText)
    const hrefJobId = sourceUrl?.match(/[?&]id=(\d+)/i)?.[1] || null
    const fallbackJobId = `${SOURCE}-${slugify(title)}-${slugify(city || location)}`

    if (!title || !sourceUrl || !location) return null

    return {
      title,
      company: COMPANY,
      department: extractDepartmentFromTitle(title),
      location,
      city,
      country: 'India',
      jobId: hrefJobId || fallbackJobId,
      requisitionId: hrefJobId || fallbackJobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  }).filter(Boolean)
}

export const buildPageRequest = ({ pageNumber = 1 } = {}) => {
  const normalizedPageNumber = Number(pageNumber) || 1
  if (normalizedPageNumber <= 1) {
    return {
      url: CAREERS_URL,
      method: 'GET',
      body: null,
    }
  }

  return {
    url: CAREERS_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: CAREERS_URL,
    },
    body: new URLSearchParams({
      page_number: String(normalizedPageNumber),
    }).toString(),
  }
}

const defaultFetchPage = async ({
  url,
  method = 'GET',
  headers = {},
  body = null,
} = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...headers,
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createYamahaScraper = ({ maxPages = DEFAULT_MAX_PAGES } = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || (options.fetchText
      ? async (request) => ({
        status: 200,
        url: request.url,
        html: await options.fetchText(request.url),
      })
      : defaultFetchPage)
    const jobsById = new Map()
    const maxPageCount = Math.max(1, Number(maxPages) || DEFAULT_MAX_PAGES)
    const firstPage = await fetchPage(buildPageRequest({ pageNumber: 1 }))
    const html = firstPage.html

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Yamaha official careers surface changed; refusing to scrape')
    }

    for (const job of extractJobCards(html)) {
      jobsById.set(job.jobId, job)
    }

    for (let pageNumber = 2; pageNumber <= maxPageCount; pageNumber += 1) {
      const page = await fetchPage(buildPageRequest({ pageNumber }))
      const pageJobs = extractJobCards(page.html)

      if (pageJobs.length === 0) break

      let foundNewJob = false
      for (const job of pageJobs) {
        if (!jobsById.has(job.jobId)) {
          jobsById.set(job.jobId, job)
          foundNewJob = true
        }
      }

      if (!foundNewJob) break
    }

    return [...jobsById.values()].map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createYamahaScraper().run(options)
