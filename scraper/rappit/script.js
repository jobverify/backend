import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'rappit'
export const COMPANY = 'Rappit'
export const HOMEPAGE_URL = 'https://rappit.io/'
export const ABOUT_URL = 'https://rappit.io/about-us/'
export const CAREERS_URL = 'https://rappit.io/about-us/careers/'
export const VACANCIES_URL = 'https://rappit.io/vacancies/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&#8217;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripHtml = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|article|span|strong)>/gi, ' ')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeWhitespace = (value) => stripHtml(value) || null

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), VACANCIES_URL).toString()
  } catch {
    return null
  }
}

const extractTitle = (html = '') => {
  const h1Match = String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  return normalizeWhitespace(h1Match?.[1] ?? '')
}

const extractMetaValue = (html = '', property) => {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRegExp(property)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  return normalizeWhitespace(String(html ?? '').match(pattern)?.[1] ?? '')
}

const extractSectionHtml = (html = '', heading) => {
  const pattern = new RegExp(
    `<h3[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h3>([\\s\\S]*?)(?=<h[1-6][^>]*>|Interested\\? Apply for this role|<section\\b|<footer\\b)`,
    'i',
  )

  return pattern.exec(String(html ?? ''))?.[1] ?? ''
}

const extractSectionText = (html = '', heading) => normalizeWhitespace(extractSectionHtml(html, heading))

const extractListItems = (html = '') => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractLabelValues = (html = '') => [...String(html ?? '').matchAll(/<div class="v-labels__label">\s*([\s\S]*?)\s*<\/div>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractIntro = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<p[^>]*class="intro"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '')

const extractPublishedDate = (html = '') => {
  const match = String(html ?? '').match(/"datePublished":"([^"]+)"/i)
  return normalizeWhitespace(match?.[1] ?? '')?.slice(0, 10) || null
}

const extractModifiedDate = (html = '') =>
  normalizeWhitespace(extractMetaValue(html, 'article:modified_time'))?.slice(0, 10) || null

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = location.split(',').map((part) => part.trim()).filter(Boolean)
  return {
    location,
    city: parts[0] || null,
    country: parts.length > 1 ? parts.at(-1) : null,
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('rappit')
    && normalized.includes('business users')
    && normalized.includes('about us')
}

export const hasRebrandAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('about us')
    && normalized.includes('vanenburg')
    && normalized.includes('rebrands')
    && normalized.includes('2009')
    && normalized.includes('2024')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('careers')
    && normalized.includes('join our team')
    && normalized.includes('experienced it professionals')
    && normalized.includes('vacancies')
}

export const hasEmptyVacanciesSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('vacancies')
    && (normalized.includes('0 vacancies') || normalized.includes('no vacancies'))
}

export const extractVacancyUrls = (html = '') => {
  const urls = [...String(html ?? '').matchAll(/href=["']([^"']*\/vacancies\/[^"'#?]+\/?)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1]))
    .filter(Boolean)
    .filter((url) => {
      try {
        const parsed = new URL(url)
        return parsed.pathname.replace(/\/+$/, '') !== '/vacancies'
      } catch {
        return false
      }
    })

  return [...new Set(urls)]
}

export const extractVacancyDetails = (html = '', detailUrl) => {
  const title = extractTitle(html)
  const labelValues = extractLabelValues(html)
  const profileHtml = extractSectionHtml(html, 'Profile')
  const responsibilitiesHtml = extractSectionHtml(html, 'Responsibilities')
  const requirementsHtml = extractSectionHtml(html, 'We also require')
  const offerHtml = extractSectionHtml(html, 'What we offer')
  const aboutHtml = extractSectionHtml(html, 'About Rappit')
  const locationParts = parseLocation(labelValues[0])
  const url = toAbsoluteUrl(detailUrl)
  const profileText = extractSectionText(html, 'Profile')
  const responsibilitiesText = extractSectionText(html, 'Responsibilities')

  if (!title || !url || !locationParts.location || !labelValues[1] || !profileText || !responsibilitiesText) {
    throw new Error('Rappit vacancy detail page no longer exposes a stable first-party title or URL')
  }

  const slug = new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || title.toLowerCase()
  const requiredSkills = [
    ...extractListItems(responsibilitiesHtml),
    ...extractListItems(requirementsHtml),
  ]

  const descriptionParts = [
    extractIntro(html),
    profileText,
    responsibilitiesText,
    extractSectionText(html, 'We also require'),
    extractSectionText(html, 'What we offer'),
    extractSectionText(html, 'About Rappit'),
  ].filter(Boolean)

  return {
    title,
    company: COMPANY,
    department: labelValues[1] || null,
    location: locationParts.location,
    city: locationParts.city,
    country: locationParts.country,
    jobId: slug,
    requisitionId: slug,
    sourceUrl: url,
    applyUrl: url,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: extractPublishedDate(html),
    closingDate: null,
    jobDescription: descriptionParts.join(' '),
    lastUpdatedDate: extractModifiedDate(html),
  }
}

export const createRappitScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Rappit homepage no longer matches the verified official public surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasRebrandAboutSignal(aboutPage.html)) {
      throw new Error('Rappit about page no longer matches the verified Vanenburg rebrand proof')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Rappit careers page changed materially or no longer matches the verified first-party handoff')
    }

    const vacanciesPage = await fetchPage(VACANCIES_URL)
    if (vacanciesPage.status !== 200) {
      throw new Error('Rappit vacancies page changed materially or no longer matches the verified first-party jobs list')
    }

    const vacancyUrls = extractVacancyUrls(vacanciesPage.html)
    if (vacancyUrls.length === 0) {
      if (hasEmptyVacanciesSignal(vacanciesPage.html)) {
        return []
      }

      throw new Error('Rappit vacancies page changed materially or no longer matches the verified first-party jobs list')
    }

    const jobs = []
    for (const vacancyUrl of vacancyUrls) {
      const detailPage = await fetchPage(vacancyUrl)
      if (detailPage.status !== 200) {
        throw new Error('Rappit vacancy detail page changed materially or is no longer reachable')
      }

      jobs.push(extractVacancyDetails(detailPage.html, detailPage.url || vacancyUrl))
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createRappitScraper().run(options)

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
