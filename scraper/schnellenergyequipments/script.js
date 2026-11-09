import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'schnellenergyequipments'
export const COMPANY = 'Schnell Energy Equipments Private Limited'
export const CAREERS_URL = 'https://schnellenergy.com/careers/'
export const APPLY_URL = 'https://schnellenergy.com/job-application/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|â€“|â€”/g, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/\.\s*$/g, '')
  if (!normalized) return null

  const withoutCountry = normalized.replace(/\s*,?\s*india\s*$/i, '')
  return `${withoutCountry.replace(/\s*,\s*/g, ', ')}, India`
}

const deriveCity = (location) => {
  const firstToken = normalizeWhitespace(String(location ?? '').replace(/,\s*India$/i, '').split(',')[0])
  return firstToken ? normalizeCity(firstToken) : null
}

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? normalizeWhitespace(match[1]) : null
}

const extractQualification = (sectionHtml) => {
  const match = /Qualification\s*:\s*([\s\S]*?)(?:Experience\s*:|<\/h6>|<br\b|$)/i.exec(sectionHtml)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractExperience = (sectionHtml) => {
  const match = /Experience\s*:\s*([\s\S]*?)(?:<\/h6>|<br\b|$)/i.exec(sectionHtml)
  return match ? normalizeWhitespace(match[1]) : null
}

const buildJobDescription = (sectionHtml) => {
  const match = /JD\s*:\s*([\s\S]*?)(?:Qualification\s*:|<\/h6>|<br\b|$)/i.exec(sectionHtml)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractOpeningCount = (sectionHtml) => {
  const countText = extractFirst(
    /No\s+of\s+Position[\s\S]*?<p[^>]*>\s*(\d+)\s*<\/p>/i,
    sectionHtml,
  )
  return countText ? Number.parseInt(countText, 10) : null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /SCHNELL\s+OPENINGS/i.test(text)
    && /Interested Candidates can apply or send their resume/i.test(text)
    && /hr\.talentacquisition@schnellenergy\.com/i.test(text)
    && /https:\/\/schnellenergy\.com\/job-application\/?/i.test(page)
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Schnell Energy Equipments verified official public careers surface changed')
  }

  const sections = [...String(html ?? '').matchAll(
    /<h5[^>]*>\s*(?:<strong>)?([\s\S]*?)(?:<\/strong>)?\s*<\/h5>([\s\S]*?)<a\b[^>]*href=["']([^"']*job-application\/?)["'][^>]*>[\s\S]*?APPLY NOW[\s\S]*?<\/a>/gi,
  )]

  const jobs = []
  const seen = new Set()

  for (const [, rawTitle, sectionHtml, rawApplyUrl] of sections) {
    const title = stripTags(rawTitle)
    const location = normalizeLocation(extractFirst(/Location\s*:\s*([^<]+)/i, sectionHtml))
    const applyUrl = normalizeWhitespace(rawApplyUrl)

    if (!title || !location || !applyUrl) continue

    const dedupeKey = `${title}::${location}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    jobs.push({
      title,
      location,
      city: deriveCity(location),
      minimumQualification: extractQualification(sectionHtml),
      experienceRequired: extractExperience(sectionHtml),
      jobDescription: buildJobDescription(sectionHtml),
      openingCount: extractOpeningCount(sectionHtml),
      sourceUrl: CAREERS_URL,
      applyUrl,
      remoteStatus: 'On-site',
    })
  }

  if (jobs.length === 0) {
    throw new Error('Schnell Energy Equipments verified public openings changed or disappeared')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSchnellEnergyEquipmentsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractOpenings(html).map((job) => {
      const identitySlug = slugify(`${job.title}-${job.location}`)

      return {
        ...job,
        company: COMPANY,
        country: 'India',
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        employmentType: null,
        requiredSkills: [],
        preferredQualification: null,
        postingDate: null,
        closingDate: null,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }
    })
  },
})

export const run = async (options = {}) => createSchnellEnergyEquipmentsScraper().run(options)

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
