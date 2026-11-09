import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'simnovus'
export const COMPANY = 'Simnovus'
export const CAREERS_URL = 'https://simnovus.com/about-us/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u2013\u2014]/g, '-'),
)

const getCurrentOpportunitiesSection = (html) => String(html ?? '').match(
  /<div class="current_box" id="open_position_section">([\s\S]*?)<div class="apply_now_buttons">/i,
)?.[1] || null

const buildRoleUrl = (jobId) => new URL(`?j=${encodeURIComponent(jobId)}`, CAREERS_URL).toString()

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const primaryLocation = normalized.split(',')[0]?.trim()
  return primaryLocation ? normalizeCity(primaryLocation) : null
}

const deriveRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/\b(remote|work\s*from\s*home|hybrid)\b/i.test(normalized)) return 'Remote'
  return 'On-site'
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers\s*-\s*Simnovus\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/simnovus\.com\/about-us\/careers\/["'][^>]*>/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Simnovus["'][^>]*>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Careers\s*-\s*Simnovus["'][^>]*>/i.test(page)
    && /id=["']open_position_section["']/i.test(page)
    && /class=["'][^"']*\bwpcf7\b/i.test(page)
    && /name=["']Applyingfor["']/i.test(page)
    && text.includes('Ready to lead with purpose?')
    && text.includes('Current opportunities')
    && text.includes('Sign up for Job Alerts')
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Simnovus verified first-party careers surface changed; refusing to scrape')
  }

  const section = getCurrentOpportunitiesSection(html)
  if (!section) {
    throw new Error('Simnovus careers page no longer exposes the verified current opportunities section')
  }

  const jobs = section
    .split(/<div class="col" id="/i)
    .slice(1)
    .map((chunk) => {
      const jobId = chunk.match(/^(\d+)"/)?.[1] || null
      const dataJobId = chunk.match(/\bdata-job="(\d+)"/i)?.[1] || null
      const title = normalizeWhitespace(chunk.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
      const rawLocation = normalizeWhitespace(
        chunk.match(/<div class="career_location_detail">[\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1],
      )
      const jobDescription = stripTags(
        chunk.match(/<div class="qualification">([\s\S]*?)<\/div>/i)?.[1],
      )

      if (!jobId || !title || !rawLocation || !jobDescription) return null
      if (dataJobId && dataJobId !== jobId) return null
      if (!/\bindia\b/i.test(rawLocation)) return null

      return {
        title,
        location: rawLocation.replace(/\bINDIA\b/i, 'India'),
        city: deriveCity(rawLocation),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: buildRoleUrl(jobId),
        applyUrl: buildRoleUrl(jobId),
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription,
        remoteStatus: deriveRemoteStatus(rawLocation),
        compensation: null,
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Simnovus careers page no longer exposes verified public India role cards')
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

export const createSimnovusScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractJobCards(html).map((job) => ({
      ...job,
      company: COMPANY,
      department: null,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createSimnovusScraper().run(options)

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
