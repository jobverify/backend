import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sanriaengineering'
export const COMPANY = 'SANRIA Engineering'
export const HOMEPAGE_URL = 'https://www.sanriaengineering.com/'
export const CONTACT_URL = 'https://www.sanriaengineering.com/contact-us.html'
export const CAREERS_URL = 'https://www.sanriaengineering.com/careers.html'
export const COMPANY_DOMAIN = 'sanriaengineering.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeVisibleText = (value) => stripTags(value) || ''

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const getBlocksByClass = (html, className) => {
  const page = String(html ?? '')
  const pattern = new RegExp(
    `<div\\b[^>]*class=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["'][^>]*>`,
    'gi',
  )
  const starts = [...page.matchAll(pattern)]

  return starts.map((match, index) => {
    const start = match.index ?? 0
    const end = starts[index + 1]?.index ?? page.length
    return page.slice(start, end)
  })
}

const extractFirstMatch = (value, pattern) =>
  normalizeWhitespace(String(value ?? '').match(pattern)?.[1] ?? null)

const extractStateFromAddress = (address) => {
  const normalized = normalizeWhitespace(address)
  if (!normalized) return null

  const withPostalCode = normalized.match(/,\s*([A-Za-z ]+?)\s+\d{6}$/)
  if (withPostalCode) return normalizeWhitespace(withPostalCode[1])

  const dashedPostalCode = normalized.match(/,\s*([A-Za-z ]+?)\s*-\s*\d{6}$/)
  if (dashedPostalCode) return normalizeWhitespace(dashedPostalCode[1])

  return null
}

const buildJobDescription = ({ summary, location, experienceRequired }) => [
  summary,
  location ? `Location: ${location}.` : null,
  experienceRequired ? `Experience: ${experienceRequired}.` : null,
  'Apply through the official SANRIA Engineering careers page popup form.',
]
  .filter(Boolean)
  .join(' ')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Sanria\s*-\s*Revolutionizing Engineering\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Sanria Engineering["']/i.test(page)
    && text.includes('revolutionizing engineering')
    && text.includes('technology-driven bim and engineering services company helping customers manage their projects better using our software tools and services')
    && /href=["']careers\.html["']/i.test(page)
    && /linkedin\.com\/company\/sanria-engineering-ltd/i.test(page)
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()
  const officeLocations = extractOfficeLocations(page)

  return /<title>\s*Contact Us\s*-\s*Sanria\s*-\s*Revolutionizing Engineering\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Sanria Engineering["']/i.test(page)
    && text.includes('our locations')
    && text.includes('our presence across bengaluru, mysuru and chennai brings together engineering talent and expertise')
    && officeLocations.Bengaluru?.state === 'Karnataka'
    && officeLocations.Mysuru?.state === 'Karnataka'
    && officeLocations.Chennai?.city === 'Chennai'
    && /mailto:habeeb@sanriaengineering\.com/i.test(page)
    && /mailto:jps@sanriaengineering\.com/i.test(page)
}

export const extractOfficeLocations = (html) =>
  Object.fromEntries(
    getBlocksByClass(html, 'location-card')
      .map((block) => {
        const city = extractFirstMatch(block, /<h4>\s*([\s\S]*?)\s*<\/h4>/i)
        const address = extractFirstMatch(block, /<p>\s*([\s\S]*?)\s*<\/p>/i)
        if (!city || !address) return null

        return [city, {
          city,
          state: extractStateFromAddress(address),
          address,
        }]
      })
      .filter(Boolean),
  )

export const extractPublicJobCards = (html) =>
  getBlocksByClass(html, 'contact-card')
    .map((block) => {
      const title = extractFirstMatch(block, /<h4>\s*([\s\S]*?)\s*<\/h4>/i)
      const paragraphs = [...String(block ?? '').matchAll(/<p>\s*([\s\S]*?)\s*<\/p>/gi)]
        .map((match) => stripTags(match[1]))
        .filter(Boolean)
      const summary = paragraphs[0] || null
      const buttonLabel = extractFirstMatch(block, /<button\b[^>]*>\s*([\s\S]*?)\s*<\/button>/i)
      const rawLocation = extractFirstMatch(
        block,
        /<strong>\s*Location:\s*<\/strong>\s*([\s\S]*?)<br/i,
      )
      const experienceRequired = extractFirstMatch(
        block,
        /<strong>\s*Experience:\s*<\/strong>\s*([\s\S]*?)<\/p>/i,
      )

      if (!title || !summary || buttonLabel !== 'Apply Now' || !rawLocation) {
        return null
      }

      return {
        title,
        summary,
        rawLocation,
        experienceRequired,
        buttonLabel,
      }
    })
    .filter(Boolean)

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page).toLowerCase()

  return /<title>\s*Careers\s*-\s*Sanria\s*-\s*Revolutionizing Engineering\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Sanria Engineering["']/i.test(page)
    && text.includes('join our team')
    && text.includes("explore exciting career opportunities at sanria. we're looking for talented professionals to join our growing team and work on innovative steel structure projects.")
    && text.includes('tekla modelers & checkers')
    && /id=["']careerForm["']/i.test(page)
    && /<label>\s*Position Applied For\b/i.test(page)
    && /<label>\s*Resume\s*\/\s*CV Link\b/i.test(page)
    && text.includes('submit application')
    && /https:\/\/api\.web3forms\.com\/submit/i.test(page)
    && /subject:\s*"New Job Application - Sanria Engineering"/i.test(page)
    && extractPublicJobCards(page).length > 0
}

export const extractPublicJobs = (careersHtml, contactHtml) => {
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('SANRIA Engineering careers page no longer matches the verified first-party public surface')
  }

  const officeLocations = extractOfficeLocations(contactHtml)

  const jobs = extractPublicJobCards(careersHtml).map((card) => {
    const office = officeLocations[card.rawLocation] || {}
    const city = card.rawLocation
    const state = office.state || null
    const location = state
      ? `${city}, ${state}, India`
      : `${city}, India`
    const requisitionId = slugify(`${SOURCE}-${card.title}-${city}`)

    return {
      title: card.title,
      company: COMPANY,
      department: null,
      location,
      city,
      state,
      country: 'India',
      jobId: requisitionId,
      requisitionId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: card.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription({
        summary: card.summary,
        location,
        experienceRequired: card.experienceRequired,
      }),
      remoteStatus: null,
    }
  })

  if (jobs.length === 0) {
    throw new Error('SANRIA Engineering careers page no longer exposes a public first-party opening')
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

export const createSanriaEngineeringScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('SANRIA Engineering official homepage no longer matches the verified first-party surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('SANRIA Engineering contact page no longer matches the verified India office surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('SANRIA Engineering careers page no longer matches the verified first-party public surface')
    }

    const jobs = extractPublicJobs(careersHtml, contactHtml)
    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: CAREERS_URL,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createSanriaEngineeringScraper().run(options)

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
