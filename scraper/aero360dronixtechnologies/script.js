export const CAREERS_URL = 'https://aero360.co.in/careers/'

const COMPANY = 'Aero360 - Dronix Technologies'
const LOCATION = 'Chennai, Tamil Nadu, India'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /aero\s*360/i.test(page)
    && /dronix\s+technologies/i.test(page)
    && /careers/i.test(page)
    && /(current\s+openings|trainees?\s+and\s+interns?)/i.test(page)
}

const extractApplyUrl = (html) => {
  const match = String(html ?? '').match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>\s*apply\s+now\s*<\/a>/i)
  return normalizeWhitespace(match?.[1]) || null
}

export const extractJobs = (html) => {
  const page = String(html ?? '')
  const headings = [...page.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi)]

  return headings.map((heading, index) => {
    const nextHeadingStart = headings[index + 1]?.index ?? page.length
    const section = page.slice((heading.index ?? 0) + heading[0].length, nextHeadingStart)
    const description = normalizeWhitespace(section.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const title = normalizeWhitespace(heading[1])
    const applyUrl = extractApplyUrl(section) || CAREERS_URL

    return {
      title,
      company: COMPANY,
      department: title,
      location: LOCATION,
      city: 'Chennai',
      country: 'India',
      jobId: `aero360dronixtechnologies-${slugify(title)}`,
      requisitionId: null,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description || 'Apply via the Aero360 careers page.',
    }
  }).filter((job) => job.title)
}

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

export const createAero360DronixTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Aero360 official careers surface changed; refusing to scrape')
    }

    return extractJobs(careersHtml).map((job) => ({
      ...job,
      source: 'aero360dronixtechnologies',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createAero360DronixTechnologiesScraper().run(options)
