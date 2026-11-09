import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  AMITY_SOFTWARE_CATALOG,
  VERIFIED_JOB_DETAIL_URLS,
} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMITY_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const VERIFIED_JOB_DETAIL_URLS_CONST = [...VERIFIED_JOB_DETAIL_URLS]
export { VERIFIED_JOB_DETAIL_URLS_CONST as VERIFIED_JOB_DETAIL_URLS }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '–')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value) => normalizeWhitespace(String(value ?? ''))

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return decodeHtmlEntities(match?.[1]) || null
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const buildJobIdFromUrl = (url) => {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '')
    return pathname.split('/').pop() || null
  } catch {
    return null
  }
}

const extractLabeledField = (html = '', label) => {
  const match = String(html ?? '').match(
    new RegExp(`<strong>\\s*${label}\\s*:<\\/strong>\\s*([^<]+)`, 'i'),
  )

  return match?.[1] ? decodeHtmlEntities(match[1]) : null
}

const extractListText = (listHtml = '') =>
  [...String(listHtml ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => decodeHtmlEntities(match[1]))
    .filter(Boolean)
    .join(' ')

const normalizeSectionHeading = (value = '') => decodeHtmlEntities(value)
  .replace(/\s*[:\-–]+\s*$/u, '')
  .trim()
  .toLowerCase()

const isResponsibilitiesHeading = (value = '') => /^(?:key\s+)?responsibilities$/i.test(value)
  || /^roles?\s+(?:&|and)\s+responsibilities$/i.test(value)

const isRequirementsHeading = (value = '') => /^(?:required\s+skills\s+and\s+qualifications|required\s+skills\s+and\s+experience|requirements|requirements\s+for\s+the\s+position)$/i.test(value)

const extractHeadingBlocks = (html = '') => (
  [...String(html ?? '').matchAll(/<(h2|p)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => ({
      index: match.index ?? 0,
      endIndex: (match.index ?? 0) + match[0].length,
      label: normalizeSectionHeading(match[2]),
    }))
    .filter((block) => isResponsibilitiesHeading(block.label) || isRequirementsHeading(block.label))
)

const extractSectionHtml = (html = '', headingBlocks = [], blockIndex = -1) => {
  const block = headingBlocks[blockIndex]

  if (!block) return ''

  const nextHeadingIndex = headingBlocks[blockIndex + 1]?.index ?? html.length
  const formIndex = String(html ?? '').slice(block.endIndex).search(/<form\b|<div[^>]+class="[^"]*wpforms-container/i)
  const formBoundary = formIndex >= 0 ? block.endIndex + formIndex : html.length
  const sectionEnd = Math.min(nextHeadingIndex, formBoundary)

  return String(html ?? '').slice(block.endIndex, sectionEnd)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'A BFSI & Agri Software Company Noida, India'
    && normalized.includes('Careers WE ARE HIRING')
    && /href=["'](?:https:\/\/www\.amitysoftware\.com)?\/careers\/["']/i.test(rawHtml)
    && /VIEW OPENINGS/i.test(rawHtml)
}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Careers | Amity Software'
    && normalized.includes('Current Openings')
    && /Apply Now/i.test(rawHtml)
    && extractOpeningCards(rawHtml).length > 0
}

export const extractOpeningCards = (html = '') =>
  String(html ?? '')
    .split('<div class="info-box-content">')
    .slice(1)
    .map((chunk) => {
      const titleMatch = chunk.match(/<h4[^>]*class="info-box-title[^"]*"[^>]*>([\s\S]*?)<\/h4>/i)
      const detailsMatch = chunk.match(
        /<strong>\s*Experience\s*<\/strong>\s*(?:–|&#8211;|&ndash;|-)\s*([^<]+)<br\s*\/?>\s*<strong>\s*Location\s*<\/strong>\s*(?:–|&#8211;|&ndash;|-)\s*([^<]+)<\/p>/i,
      )
      const detailUrlMatch = chunk.match(
        /<a href="(https:\/\/www\.amitysoftware\.com\/[^"]+\/)"[^>]*>Apply Now<\/a>/i,
      )

      if (!titleMatch || !detailsMatch || !detailUrlMatch) {
        return null
      }

      return {
        title: decodeHtmlEntities(titleMatch[1]),
        experience: decodeHtmlEntities(detailsMatch[1]),
        location: decodeHtmlEntities(detailsMatch[2]),
        detailUrl: detailUrlMatch[1],
      }
    })
    .filter(Boolean)

export const hasEmbeddedApplyFormSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return /wpforms-form/i.test(rawHtml)
    && /type="file"/i.test(rawHtml)
}

export const extractPostingDate = (html = '') => {
  const match = String(html ?? '').match(/"datePublished":"([^"]+)"/i)
  return match?.[1] ? match[1].slice(0, 10) : null
}

export const extractEmploymentType = (html = '') =>
  extractLabeledField(html, 'Employment Type')

export const extractJobDescription = (html = '') => {
  const headingBlocks = extractHeadingBlocks(html)
  const requirementsBlockIndex = headingBlocks.findIndex((block) => isRequirementsHeading(block.label))

  if (requirementsBlockIndex === -1) return null

  const responsibilitiesBlockIndex = headingBlocks
    .slice(0, requirementsBlockIndex)
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isResponsibilitiesHeading(block.label))
    .map(({ index }) => index)
    .at(-1)

  if (responsibilitiesBlockIndex === undefined) return null

  const responsibilities = extractListText(
    extractSectionHtml(html, headingBlocks, responsibilitiesBlockIndex),
  )
  const skills = extractListText(
    extractSectionHtml(html, headingBlocks, requirementsBlockIndex),
  )

  if (!responsibilities || !skills) return null

  return `Key Responsibilities: ${responsibilities} Required Skills and Qualifications: ${skills}`.trim()
}

const hasVerifiedDetailContent = (html = '') =>
  extractJobDescription(html) !== null
  && extractPostingDate(html) !== null
  && hasEmbeddedApplyFormSignal(html)

const mapCardToJob = (card, detailHtml, now) => ({
  title: card.title,
  company: COMPANY,
  department: null,
  location: card.location,
  city: card.location === 'Noida' ? 'Noida' : null,
  country: 'India',
  jobId: buildJobIdFromUrl(card.detailUrl),
  requisitionId: null,
  sourceUrl: card.detailUrl,
  applyUrl: card.detailUrl,
  employmentType: extractEmploymentType(detailHtml),
  experienceRequired: card.experience,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: extractPostingDate(detailHtml),
  closingDate: null,
  jobDescription: extractJobDescription(detailHtml),
  source: SOURCE,
  link: card.detailUrl,
  scrapedAt: now(),
})

export const createAmitySoftwareScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Amity Software verified homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Amity Software verified careers page no longer matches the known first-party surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (
      sitemapPage.status !== 200
      || !/post-sitemap\.xml/i.test(sitemapPage.html)
      || !/page-sitemap\.xml/i.test(sitemapPage.html)
    ) {
      throw new Error('Amity Software verified sitemap surface changed')
    }

    const cards = extractOpeningCards(careersPage.html)
    const detailUrls = cards.map((card) => card.detailUrl)

    if (
      cards.length === 0
      || !detailUrls.every((url) => VERIFIED_JOB_DETAIL_URLS.includes(url))
    ) {
      throw new Error('Amity Software verified careers page no longer matches the known first-party surface')
    }

    const jobs = []

    for (const card of cards) {
      const detailPage = await fetchPage(card.detailUrl)

      if (detailPage.status !== 200 || !hasVerifiedDetailContent(detailPage.html)) {
        throw new Error(`Amity Software detail page surface changed: ${card.detailUrl}`)
      }

      jobs.push(mapCardToJob(card, detailPage.html, now))
    }

    return jobs
  },
})

export const run = async (options = {}) => createAmitySoftwareScraper().run(options)

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
