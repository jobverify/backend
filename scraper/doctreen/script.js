import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREER_PAGE_URL = 'https://www.doctreen.com/carrieres'
export const PAGES_SITEMAP_URL = 'https://www.doctreen.com/pages-sitemap.xml'

const SOURCE = 'doctreen'
const COMPANY = 'Doctreen'

const normalize = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const toSlug = (value) => normalize(value)
  ?.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const findHeading = (html, predicate) => {
  for (const match of String(html ?? '').matchAll(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi)) {
    const text = normalize(match[0])?.toLowerCase()

    if (text && predicate(text)) {
      return match
    }
  }

  return null
}

const getOpeningsSection = (html) => {
  const page = String(html ?? '').replace(/\u2019/g, "'")
  const heading = findHeading(
    page,
    (text) => text === 'nous recherchons activement ces profils',
  )
  const applicationHeading = findHeading(
    page,
    (text) => text.startsWith("envie de rejoindre l'aventure doctreen ?"),
  )

  if (!heading || !applicationHeading || applicationHeading.index <= heading.index) {
    throw new Error('Doctreen careers page no longer exposes the expected openings page shape')
  }

  const applicationSection = page.slice(applicationHeading.index)
  if (!normalize(applicationSection)?.toLowerCase().includes("j'envoie ma candidature")) {
    throw new Error('Doctreen careers page no longer exposes the expected openings page shape')
  }

  return page.slice(heading.index, applicationHeading.index)
}

const extractTitlesFromAccordion = (html) => [...String(html ?? '').matchAll(
  /<button\b[^>]*aria-controls=["'][^"']+["'][^>]*>([\s\S]*?)<\/button>/gi,
)]
  .map((match) => normalize(match[1]))
  .filter(Boolean)

const extractTitlesFromList = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalize(match[1]))
  .filter(Boolean)

export const extractCareerJobs = (html) => {
  const section = getOpeningsSection(html)
  const titles = extractTitlesFromAccordion(section)
  const extractedTitles = titles.length > 0 ? titles : extractTitlesFromList(section)

  if (extractedTitles.length === 0) {
    throw new Error('Doctreen careers page no longer exposes the expected openings page shape')
  }

  return [...new Set(extractedTitles)].map((title) => {
    const jobId = toSlug(title)

    return {
      title,
      company: COMPANY,
      department: null,
      location: 'France',
      city: null,
      country: 'France',
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
      jobDescription: null,
      remoteStatus: 'On-site',
    }
  })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createDoctreenScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREER_PAGE_URL)
    if (/<title[^>]*>[^<]*Doctreen[^<]*<\/title>/i.test(html)
      && /https:\/\/www\.doctreen\.com\/a-propos/i.test(html)
      && /Montpellier/i.test(html)
      && !/Nous recherchons activement/i.test(html)) {
      const sitemap = await fetchText(PAGES_SITEMAP_URL)
      const locs = [...String(sitemap).matchAll(/<loc>([^<]+)<\/loc>/gi)].map(match => match[1])
      if (!/<urlset\b/i.test(sitemap)
        || !locs.includes('https://www.doctreen.com/a-propos')
        || locs.some(url => /\/(?:carrieres|careers|jobs|offres)(?:\/|$)/i.test(url))) {
        throw new Error('Doctreen current page sitemap no longer proves the careers route is retired')
      }
      return attachInventoryEvidence([], {
        status: 'verified-empty',
        surface: PAGES_SITEMAP_URL,
        firstParty: true,
        listingComplete: true,
        pagesFetched: 2,
        reportedTotal: 0,
        indiaFacetCount: 0,
        verifiedAt: new Date().toISOString(),
        reason: 'doctreen-retired-careers-route-no-public-openings',
      })
    }
    const jobs = extractCareerJobs(html)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createDoctreenScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`Doctreen jobs scraped: ${jobs.length}`)
}
