import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'harmonyenvironmentalsystemsprivatelimited'
export const COMPANY = 'Harmony Environmental Systems Private Limited'
export const HOMEPAGE_URL = 'https://harmonyenviro.in/'
export const ABOUT_URL = 'https://harmonyenviro.in/who-we-are/'
export const CONTACT_URL = 'https://harmonyenviro.in/contact-us/'
export const CAREERS_URL = 'https://harmonyenviro.in/career/'
export const CAREERS_SITEMAP_URL = 'https://harmonyenviro.in/careers-sitemap.xml'
export const APPLY_URL = CAREERS_URL

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DETAIL_URL_REGEX = /^https:\/\/harmonyenviro\.in\/career\/([a-z0-9-]+)\/$/i
const INDIA_LOCATION_META = {
  chennai: { city: 'Chennai', state: 'Tamil Nadu' },
  gujarat: { city: null, state: 'Gujarat' },
  noida: { city: 'Noida', state: 'Uttar Pradesh' },
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/[\u200b-\u200d\u2060\ufeff]/g, ' ')
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/\s+\?\s*/g, ' ')
  .replace(/\?+\s*<\/li>/gi, '</li>')
  .replace(/(\d)\s*-\s*(\d)/g, '$1 - $2')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|h[1-6]|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeLocationText = (value) => normalizeWhitespace(value)?.replace(/\s*,\s*/g, ', ') || null

const normalizeExperienceText = (value) => normalizeWhitespace(value)
  ?.replace(/\bYears\b/gi, 'Years')
  ?.replace(/\byrs\b/gi, 'yrs') || null

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

const deriveJobId = (sourceUrl) => {
  const match = String(sourceUrl ?? '').match(DETAIL_URL_REGEX)
  return match?.[1] || null
}

const deriveLocationMeta = (location) => {
  const normalized = normalizeLocationText(location)?.toLowerCase() || null
  if (!normalized) {
    return { city: null, state: null }
  }

  return INDIA_LOCATION_META[normalized] || {
    city: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    state: null,
  }
}

const extractJobDetailSection = (html) => {
  const page = String(html ?? '')
  return page.match(/<div class="Jobtitletb">([\s\S]*?)<\/div>/i)?.[1] || null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = stripTags(html).toLowerCase()

  return normalized.includes('welcome to harmony environmental solutions')
    && normalized.includes('innovative solutions for a sustainable future')
    && normalized.includes('leading the way in air quality systems')
    && normalized.includes('at harmony, we offer integrated solutions including design and engineering services')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = stripTags(html)

  return normalized.includes('Harmony Environmental Systems Private Limited (HESPL) offers Air Quality Systems to Industries across the world')
    && normalized.includes('In December 2022, HESPL acquired the Indian based operations of Hamon Research Cottrell India Pvt. Ltd. (HRCIN)')
    && normalized.includes('Headquartered in Chennai, India, HESPL aims to support sustainable growth and development of industry')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = stripTags(html)

  return normalized.includes('Pacifica Tech Park, Block 1, 1st Floor, Core-2')
    && normalized.includes('23 Rajiv Gandhi Salai (OMR), Navalur, Chennai')
    && normalized.includes('info@harmonyenviro.in')
    && normalized.includes('+91 (44) 4909 0500')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = stripTags(page)

  return normalized.includes('Current Openings')
    && normalized.includes('Work with Harmony')
    && normalized.includes('E&I Design Engineer')
    && normalized.includes('Mechanical Engineer')
    && /name="your-name"/i.test(page)
    && /name="your-email"/i.test(page)
    && /name="Your-phone"/i.test(page)
    && /name="your-position"/i.test(page)
}

export const hasOfficialDetailSignal = (html) => {
  const page = String(html ?? '')
  const normalized = stripTags(page)

  return /class="entry-title fusion-post-title"/i.test(page)
    && /class="Jobtitletb"/i.test(page)
    && /name="your-name"/i.test(page)
    && /name="your-email"/i.test(page)
    && /name="Your-phone"/i.test(page)
    && normalized.includes('Location')
    && normalized.includes('Experience')
}

export const extractCareerCards = (html) => {
  const cards = []
  const page = String(html ?? '')

  for (const match of page.matchAll(
    /<div class="fusion-text carerjobtb careers-post[\s\S]*?<h4>([\s\S]*?)<\/h4>[\s\S]*?<strong>\s*Location\s*:\s*<\/strong>\s*([^<]+)<\/li>[\s\S]*?<strong>\s*Experience\s*:\s*<\/strong>\s*([^<]+)<\/li>/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const location = normalizeLocationText(match[2])
    const experienceRequired = normalizeExperienceText(match[3])

    if (!title || !location || !experienceRequired) continue

    cards.push({
      title,
      location,
      experienceRequired,
      applyUrl: APPLY_URL,
    })
  }

  return cards
}

export const extractDetailUrlsFromSitemap = (xml) => {
  const urls = []
  const seen = new Set()

  for (const match of String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const url = normalizeWhitespace(match[1])
    if (!url || !DETAIL_URL_REGEX.test(url) || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
}

export const extractJobDetail = (html, sourceUrl) => {
  if (!hasOfficialDetailSignal(html)) {
    throw new Error(`Harmony verified detail page changed materially: ${sourceUrl}`)
  }

  const page = String(html ?? '')
  const section = extractJobDetailSection(page)
  if (!section) {
    throw new Error(`Harmony detail section missing from verified detail page: ${sourceUrl}`)
  }

  const title = normalizeWhitespace(
    page.match(/<h1[^>]*class="entry-title fusion-post-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  )
  const rawListItems = [...section.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(stripTags(match[1])))
    .filter(Boolean)
  const minimumQualification = rawListItems.find(
    (item) => !/^Location\s*:|^Experience\s*:|^position\s*:/i.test(item),
  ) || null
  const location = normalizeLocationText(
    section.match(/<strong>\s*Location\s*<\/strong>\s*:?\s*([^<]+)<\/li>/i)?.[1],
  )
  const experienceRequired = normalizeExperienceText(
    section.match(/<strong>\s*Experience\s*<\/strong>\s*:?\s*([^<]+)<\/li>/i)?.[1],
  )
  const jobDescription = normalizeWhitespace(
    section.match(/<\/ul>\s*<p>([\s\S]*?)<\/p>/i)?.[1],
  )
  const jobId = deriveJobId(sourceUrl)
  const locationMeta = deriveLocationMeta(location)

  if (!title || !location || !jobId) {
    throw new Error(`Harmony detail extraction failed for verified detail page: ${sourceUrl}`)
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: locationMeta.city,
    state: locationMeta.state,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: APPLY_URL,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: jobDescription || null,
    remoteStatus: 'On-site',
  }
}

const hasMatchingCareerCard = (job, cards = []) =>
  cards.some((card) =>
    card.title === job.title
    && normalizeLocationText(card.location)?.toLowerCase() === normalizeLocationText(job.location)?.toLowerCase(),
  )

export const createHarmonyEnvironmentalSystemsPrivateLimitedScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Harmony verified homepage no longer matches the trusted first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Harmony verified about page no longer matches the trusted first-party surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('Harmony verified contact page no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Harmony verified careers page no longer matches the trusted first-party surface')
    }

    const careerCards = extractCareerCards(careersHtml)
    if (careerCards.length === 0) {
      throw new Error('Harmony verified careers page no longer exposes the trusted public openings cards')
    }

    const sitemapXml = await fetchText(CAREERS_SITEMAP_URL)
    const detailUrls = extractDetailUrlsFromSitemap(sitemapXml)
    if (detailUrls.length === 0) {
      throw new Error('Harmony career sitemap no longer exposes verified detail URLs')
    }

    if (detailUrls.length !== careerCards.length) {
      throw new Error('Harmony career sitemap no longer mirrors the verified public openings count')
    }

    const selectedUrls = Number.isInteger(maxJobs) ? detailUrls.slice(0, maxJobs) : detailUrls
    const jobs = []

    for (const detailUrl of selectedUrls) {
      const detailHtml = await fetchText(detailUrl)
      const job = extractJobDetail(detailHtml, detailUrl)

      if (!hasMatchingCareerCard(job, careerCards)) {
        throw new Error(`Harmony detail page no longer matches a verified career card: ${detailUrl}`)
      }

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) =>
  createHarmonyEnvironmentalSystemsPrivateLimitedScraper().run(options)

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
