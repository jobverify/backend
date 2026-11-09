import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NUVENTO_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NUVENTO_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_HUB_URL = PROVIDER_METADATA.careersHubUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/[–—]/g, '-')
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => decodeHtmlEntities(value)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|summary|details)>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n- ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+\n/g, '\n')
  .replace(/\n\s+/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[ \t]+/g, ' ')
  .trim()

const extractLabelValue = (block, label) => {
  const regex = new RegExp(`(?:^|[>\\n])\\s*${label}\\s*:\\s*([^<\\n]+)`, 'i')
  const match = String(block ?? '').match(regex)
  return match ? normalizeWhitespace(match[1]) : null
}

const toWorkplaceType = (location, workMode) => {
  const text = `${location || ''} ${workMode || ''}`.toLowerCase()
  if (text.includes('remote')) return 'Remote'
  if (text.includes('hybrid')) return 'Hybrid'
  if (text.includes('onsite') || text.includes('on site')) return 'Onsite'
  return null
}

const toCity = (location) => {
  const value = String(location ?? '')
    .replace(/\(.*?\)/g, '')
    .trim()

  if (!value || /^pan india$/i.test(value) || /^kerala$/i.test(value)
    || /^(?:hybrid|remote|work.from.office)/i.test(value)) {
    return null
  }

  const token = value.split(',')[0].trim()
  const normalized = normalizeCity(token)
  if (!normalized || /india|kerala/i.test(normalized)) {
    return null
  }

  return normalized
}

export const hasOfficialCareersHubSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return normalized.includes('Careers')
    && normalized.includes('Careers in India')
    && /href=["'](?:https:\/\/nuvento\.com)?\/careers\/kochi\/["']/i.test(rawHtml)
}

export const hasOfficialIndiaCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return (
    /Nuvento\s*-\s*India/i.test(normalized)
    || /<title>\s*kochi\s*-\s*Nuvento\s*<\/title>/i.test(rawHtml)
  )
    && /property=["']og:site_name["']\s+content=["']Nuvento["']/i.test(rawHtml)
    && normalized.includes('naseeba.parvin@nuvento.com')
    && normalized.includes('anindita.ghosal@nuvento.com')
    && normalized.includes('Build your Career with Nuvento')
    && /Location\s*:/i.test(normalized)
    && extractRoleSections(rawHtml).length > 0
}

const extractLegacyRoleSections = (html = '') => {
  const matches = [...String(html ?? '').matchAll(
    /<h4>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4>|<h6[^>]*>\s*Address|<\/body>)/gi,
  )]

  return matches
    .map((match) => ({
      title: normalizeWhitespace(match[1]),
      body: match[2],
    }))
    .filter((section) => section.title)
}

const extractAccordionRoleSections = (html = '') => {
  const matches = [...String(html ?? '').matchAll(
    /<details\b[^>]*class=["'][^"']*e-n-accordion-item[^"']*["'][^>]*>[\s\S]*?<\/details>/gi,
  )]

  return matches
    .map((match) => {
      const title = normalizeWhitespace(
        match[0].match(
          /<div\b[^>]*class=["'][^"']*e-n-accordion-item-title-text[^"']*["'][^>]*>\s*([\s\S]*?)\s*<\/div>/i,
        )?.[1],
      )

      return {
        title,
        body: match[0].replace(/^[\s\S]*?<\/summary>/i, ''),
      }
    })
    .filter((section) => section.title)
}

const dedupeRoleSections = (sections = []) => {
  const seen = new Set()

  return sections.filter((section) => {
    const key = `${section.title.toLowerCase()}::${normalizeWhitespace(stripTags(section.body)).toLowerCase()}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export const extractRoleSections = (html = '') => dedupeRoleSections([
  ...extractLegacyRoleSections(html),
  ...extractAccordionRoleSections(html),
])

const extractExperienceFromText = (text = '') => {
  const match = String(text).match(/\b(\d+\s*[-+]\s*\d*\s*years?)\b/i)
  return match ? normalizeWhitespace(match[1]).replace(/\s+/g, ' ') : null
}

const toJobDescription = (body) => stripTags(body) || null

const mapRoleSectionToJob = (section) => {
  const location = extractLabelValue(section.body, 'Location')
  const workMode = extractLabelValue(section.body, 'Work Mode')
  const explicitExperience = extractLabelValue(section.body, 'Experience')
  const fallbackExperience = extractExperienceFromText(stripTags(section.body))

  return {
    title: section.title,
    location,
    city: toCity(location),
    workplaceType: toWorkplaceType(location, workMode),
    experienceRequired: explicitExperience || fallbackExperience,
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    companyCareerPage: CAREERS_URL,
    jobDescription: toJobDescription(section.body),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNuventoSystemsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHubHtml = await fetchText(CAREERS_HUB_URL)
    if (!hasOfficialCareersHubSignal(careersHubHtml)) {
      throw new Error('Nuvento Systems careers hub no longer matches the verified first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialIndiaCareersSignal(careersHtml)) {
      throw new Error('Nuvento Systems India careers page no longer matches the verified first-party surface')
    }

    const jobs = extractRoleSections(careersHtml)
      .map(mapRoleSectionToJob)
      .filter((job) => job.title)
      .sort((left, right) => left.title.localeCompare(right.title))

    if (jobs.length === 0) {
      throw new Error('Nuvento Systems no longer exposes public first-party openings on the India careers page')
    }

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      country: 'India',
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createNuventoSystemsScraper().run(options)

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
