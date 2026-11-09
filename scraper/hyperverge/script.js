export const CAREERS_URL = 'https://hyperverge.co/careers/'

const COMPANY = 'HyperVerge'
const INDIA_CITIES = new Set(['bengaluru', 'bangalore', 'coimbatore', 'chennai', 'mumbai'])

const normalizeText = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const slugify = (value) => normalizeText(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /hyperverge/i.test(page)
    && /careers/i.test(page)
    && /open\s+positions/i.test(page)
    && /apply\s+now/i.test(page)
}

const getFieldAfterImage = (html, imageLabel) => {
  const pattern = new RegExp(
    `<img\\b[^>]*\\balt=["'][^"']*${imageLabel}[^"']*["'][^>]*>\\s*([^<]+)`,
    'i',
  )

  return normalizeText(String(html ?? '').match(pattern)?.[1])
}

const getTitle = (html) => {
  const headings = [...String(html ?? '').matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
  const heading = headings.at(-1)?.[1]
  if (normalizeText(heading)) return normalizeText(heading)

  const beforeLocation = String(html ?? '').split(/<img\b[^>]*\balt=["'][^"']*location[^"']*["'][^>]*>/i)[0]
  return normalizeText(beforeLocation)
}

const getApplyCards = (html) => {
  const page = String(html ?? '')
  const anchors = [...page.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>\s*apply\s+now\s*<\/a>/gi)]

  return anchors.map((anchor, index) => {
    const previousEnd = index === 0 ? 0 : (anchors[index - 1].index ?? 0) + anchors[index - 1][0].length
    return {
      html: page.slice(previousEnd, anchor.index),
      applyUrl: normalizeText(anchor[1]),
    }
  })
}

export const extractJobCards = (html) => getApplyCards(html)
  .map(({ html: cardHtml, applyUrl }) => {
    const title = getTitle(cardHtml)
    const city = getFieldAfterImage(cardHtml, 'location')
    const employmentType = getFieldAfterImage(cardHtml, '\\bjob\\b(?![^"\']*location)')

    if (!title || !city || !applyUrl || !INDIA_CITIES.has(city.toLowerCase())) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location: `${city}, India`,
      city,
      country: 'India',
      jobId: `hyperverge-${slugify(title)}-${slugify(city)}`,
      requisitionId: null,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createHyperVergeScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('HyperVerge official careers surface changed; refusing to scrape')
    }

    return extractJobCards(careersHtml).map((job) => ({
      ...job,
      source: 'hyperverge',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createHyperVergeScraper().run(options)
