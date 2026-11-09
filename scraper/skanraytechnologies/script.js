export const CAREER_PAGE_URL = 'https://skanray.com/forms/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OPENINGS_KEYWORD_PATTERN = /current\s+openings?|open\s+(?:positions?|roles?)|career\s+opportunities|vacancies|we\s+are\s+hiring/i
const NOISE_PATTERN = /^(?:name|email|phone|message|resume|upload resume|current location|job title|apply(?: now| here| for open roles)?|submit|choose file|current openings?|open positions?|open roles?|career opportunities|vacancies)$/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const looksLikeRoleTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (NOISE_PATTERN.test(normalized)) return false
  if (normalized.endsWith(':')) return false
  if (!/[A-Za-z]/.test(normalized)) return false

  const words = normalized.split(/\s+/)
  if (words.length < 2 || words.length > 8) return false
  if (/[.?!]/.test(normalized)) return false

  return true
}

const collectListItemTitles = (html) => {
  const matches = [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]

  return matches
    .map((match) => stripTags(match[1]))
    .filter((value) => looksLikeRoleTitle(value))
}

const collectScopedListTitles = (html) => {
  const page = String(html ?? '')
  const scopedMatches = [...page.matchAll(
    /(?:current\s+openings?|open\s+(?:positions?|roles?)|career\s+opportunities|vacancies|we\s+are\s+hiring)[\s\S]{0,1200}?<ul\b[^>]*>([\s\S]*?)<\/ul>/gi,
  )]

  return scopedMatches
    .flatMap((match) => [...String(match[1] ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)])
    .map((match) => stripTags(match[1]))
    .filter((value) => looksLikeRoleTitle(value))
}

export const extractSearchResults = (html) => {
  const page = String(html ?? '')
  const scopedTitles = collectScopedListTitles(page)
  const fallbackTitles = scopedTitles.length > 0 || !OPENINGS_KEYWORD_PATTERN.test(page)
    ? []
    : collectListItemTitles(page)

  const titles = [...new Set([...scopedTitles, ...fallbackTitles])]
    .sort((left, right) => left.localeCompare(right))

  return titles.map((title) => {
    const jobId = `skanraytechnologies-${slugify(title)}`

    return {
      title,
      company: 'Skanray Technologies',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: CAREER_PAGE_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: `Apply via the Skanray Technologies careers form page for the ${title} opening.`,
    }
  })
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createSkanrayTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREER_PAGE_URL)
    const jobs = extractSearchResults(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: 'skanraytechnologies',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createSkanrayTechnologiesScraper().run(options)
