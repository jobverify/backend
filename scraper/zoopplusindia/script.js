import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

export const SOURCE = 'zoopplusindia'
export const COMPANY = 'ZoopPlus India'
export const OFFICIAL_BRAND = 'ZOOP'
export const CAREERS_URL = 'https://www.zoop.one/career'
export const DISPOSITION = 'verified-official-brand-careers-surface-with-current-empty-shell'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://www.zoop.one/career remains the live official ZOOP careers surface reviewed for workbook company ZoopPlus India, but the page now renders a branded no-openings shell with the title "Career | Join Our Team", footer contact markers such as sales@zoop.one and grievance@zoop.one, and no current public role cards or Google Forms apply links. This scraper preserves the historical rendered role-card parser if first-party cards reappear, while returning an honest empty result for the current verified shell.'

const LEGACY_REQUIRED_SURFACE_PATTERNS = [
  /\bCareer\s*\|\s*Join Our Team\b/i,
  /\bDo Work That Matters\.\s*With People Who Care\./i,
  /\bView Openings\b/i,
  /\bAbout ZOOP\b/i,
  /\bWhy Join Us\?/i,
]

const CURRENT_EMPTY_SHELL_PATTERNS = [
  /<title[^>]*>\s*Career\s*\|\s*Join Our Team\s*<\/title>/i,
  /\bView Openings\b/i,
  /\bAbout ZOOP\b/i,
  /\bWhy Join Us\?/i,
  /\bTower B,\s*Panchsheel Business Park\b/i,
  /\bsales@zoop\.one\b/i,
  /\bgrievance@zoop\.one\b/i,
  /\bJoin our journey today!/i,
  /\bQuagga Tech Pvt\. Ltd\./i,
]

const GOOGLE_FORMS_HOST_PATTERN = /^https:\/\/forms\.gle\//i

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')

const normalizeWhitespace = (value = '') =>
  decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const slugify = (value = '') =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const assertVerifiedOfficialBrandCareersSurface = (html = '') => {
  const rawHtml = String(html)
  const text = normalizeText(html)

  if (LEGACY_REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(text))) return
  if (CURRENT_EMPTY_SHELL_PATTERNS.every((pattern) => pattern.test(rawHtml))) return

  throw new Error(
    'ZoopPlus India verified official brand careers surface changed; review the ZOOP public contract before promoting a real parser.',
  )
}

const isCurrentVerifiedEmptyShell = (html = '') =>
  CURRENT_EMPTY_SHELL_PATTERNS.every((pattern) => pattern.test(String(html)))

export const extractRenderedRoleCards = (html = '') => {
  const cards = []
  const seen = new Set()

  for (const match of String(html).matchAll(/<a\b[^>]*href=["'](https:\/\/forms\.gle\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const applyUrl = normalizeWhitespace(match[1])
    const block = match[2] || ''
    const title = normalizeWhitespace(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const spans = [...block.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((spanMatch) => normalizeWhitespace(spanMatch[1]))
      .filter(Boolean)

    if (!title || spans.length < 4 || !GOOGLE_FORMS_HOST_PATTERN.test(applyUrl || '')) continue

    const [department, experienceRequired, city, employmentType] = spans
    const jobId = slugify(`${title}-${department}-${city}-${employmentType}`)
    if (!jobId || seen.has(jobId)) continue

    seen.add(jobId)
    cards.push({
      title,
      department,
      experienceRequired,
      city,
      employmentType,
      applyUrl,
    })
  }

  return cards
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchBrowserHtml = async (url) => {
  const session = await createBrowserFetchSession({
    waitUntil: 'domcontentloaded',
    settleTimeMs: 5000,
    timeoutMs: 90000,
    ignoreHTTPSErrors: false,
  })

  try {
    const page = await session.fetchPage(url)
    if (page.status < 200 || page.status >= 400) {
      throw new Error(`HTTP ${page.status} for ${url}`)
    }

    return page.html
  } finally {
    await session.close()
  }
}

const mapRoleCardToJob = (card) => ({
  title: card.title,
  company: COMPANY,
  department: card.department,
  location: `${card.city}, India`,
  city: card.city,
  country: 'India',
  jobId: slugify(`${card.title}-${card.department}-${card.city}-${card.employmentType}`),
  requisitionId: null,
  sourceUrl: CAREERS_URL,
  applyUrl: card.applyUrl,
  employmentType: card.employmentType,
  experienceRequired: card.experienceRequired,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: `Apply via the official ZOOP careers page for ${card.title} (${card.department}, ${card.experienceRequired}, ${card.city}).`,
})

export const createZoopPlusIndiaScraper = () => ({
  async run({
    fetchHtml = defaultFetchHtml,
    fetchBrowserHtml = defaultFetchBrowserHtml,
    now = () => new Date().toISOString(),
  } = {}) {
    let html = await fetchHtml(CAREERS_URL)
    let cards = extractRenderedRoleCards(html)

    if (cards.length === 0) {
      html = await fetchBrowserHtml(CAREERS_URL)
      cards = extractRenderedRoleCards(html)
    }

    assertVerifiedOfficialBrandCareersSurface(html)

    if (cards.length === 0) {
      if (isCurrentVerifiedEmptyShell(html)) {
        return []
      }

      throw new Error(
        'ZoopPlus India rendered careers surface no longer exposes the verified first-party role-card contract.',
      )
    }

    return cards.map((card) => ({
      ...mapRoleCardToJob(card),
      source: SOURCE,
      link: card.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createZoopPlusIndiaScraper().run(options)
