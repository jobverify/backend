import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bluebrix'
export const COMPANY = 'blueBriX'
export const HOMEPAGE_URL = 'https://bluebrix.health/'
export const CAREERS_URL = 'https://careers.bluebrix.health/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeText = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/\u2022/g, '|')
  .replace(/&bull;|&#8226;/gi, '|')
  .replace(/&#038;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const slugify = (value) => normalizeText(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeLocation = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  if (/kochi/i.test(normalized)) {
    return {
      location: 'Kochi, Kerala, India',
      city: 'Kochi',
      country: 'India',
    }
  }

  if (/india/i.test(normalized)) {
    return {
      location: normalized,
      city: normalizeText(normalized.split(',')[0]),
      country: 'India',
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page) || ''

  return /blueBriX/i.test(page)
    && /(?:value-based care|EHR software|Low code-no code Platform|AI-powered healthcare operations)/i.test(normalized)
    && /href=["']https:\/\/careers\.bluebrix\.health\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page) || ''

  return /blueBriX/i.test(page)
    && /(?:Open Roles|All roles|Explore all open roles)/i.test(normalized)
    && /Apply Here/i.test(page)
    && /<form\b/i.test(page)
    && (/<article\b/i.test(page) || /class=["'][^"']*\broles-card\b/i.test(page))
}

const extractRoleCards = (html) => [...String(html ?? '').matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)]
  .map((match) => match[1])

const extractCurrentRoleCards = (html) => {
  const published = [...String(html ?? '').matchAll(/<div\b[^>]*class=["']job-roles-card-info["'][^>]*>([\s\S]*?)<\/div>/gi)].map(match => match[1])
  if (published.length) return published
  return [...String(html ?? '').matchAll(/<div\b[^>]*class=["'][^"']*\broles-card\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\broles-card\b|<div\b[^>]*class=["'][^"']*\bmodal\b|<\/section>)/gi)]
    .map((match) => match[1])
}

const extractHref = (html) => {
  const href = String(html ?? '').match(/<a\b[^>]+href=["']([^"']+)["']/i)?.[1]
  if (!href) return null

  try {
    return new URL(href, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractMetaParts = (value) =>
  String(value ?? '')
    .split(/[|\u2022]/u)
    .map((part) => normalizeText(part))
    .filter(Boolean)

const parseRoleCard = (cardHtml) => {
  const title = normalizeText(cardHtml.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1])
  const department = normalizeText(cardHtml.match(/<div\b[^>]*class=["'][^"']*\broles-header\b[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1])
  const jobDescription = normalizeText(cardHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1])
  const actionText = normalizeText(cardHtml.match(/<div\b[^>]*class=["'][^"']*\broles-action\b[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]
    || cardHtml.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1])
  const sourceUrl = extractHref(cardHtml) || CAREERS_URL
  const metaParts = extractMetaParts(actionText)
  const locationData = normalizeLocation(metaParts.at(-1))

  if (!title || !actionText) {
    throw new Error('blueBriX verified first-party role cards changed shape')
  }

  if (!locationData) return null

  const jobId = `${SOURCE}-${slugify(title)}-${slugify(locationData.city)}`

  return {
    title,
    company: COMPANY,
    department,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: metaParts.find((part) => /full-time|part-time|contract|intern/i.test(part)) || null,
    experienceRequired: metaParts.find((part) => /\b\d+\s*-\s*\d+\s*years?\b/i.test(part)) || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
  }
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('blueBriX verified first-party careers page no longer matches the trusted public surface')
  }

  const cards = extractRoleCards(html)
  if (cards.length === 0) {
    const roleCards = extractCurrentRoleCards(html)
    if (roleCards.length === 0) {
      throw new Error('blueBriX verified first-party careers page no longer exposes public role cards')
    }

    return roleCards.map(parseRoleCard).filter(Boolean)
  }

  return cards.map((cardHtml) => {
    const title = normalizeText(cardHtml.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1])
    const paragraphs = [...cardHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => normalizeText(match[1]))
      .filter(Boolean)
    const locationData = normalizeLocation(paragraphs[0])
    const jobDescription = paragraphs[1] || null

    if (!title || paragraphs.length === 0) {
      throw new Error('blueBriX verified first-party role cards changed shape')
    }

    if (!locationData) return null

    const jobId = `${SOURCE}-${slugify(title)}-${slugify(locationData.city)}`

    return {
      title,
      company: COMPANY,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
    }
  }).filter(Boolean)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createBlueBrixScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('blueBriX verified official homepage no longer matches the trusted first-party surface')
    }

    let careersHtml = await fetchText(CAREERS_URL)
    let listingUrl = CAREERS_URL
    if (!hasOfficialCareersSignal(careersHtml)) {
      const handoffs = [...String(careersHtml).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .filter(match => /^(?:All roles|Explore all open roles)$/i.test(normalizeText(match[2]) || ''))
        .map(match => new URL(match[1], CAREERS_URL).href)
      const urls = [...new Set(handoffs)].filter(url => url === new URL('/all-roles/', CAREERS_URL).href)
      if (urls.length !== 1 || !/blueBriX/i.test(careersHtml)) {
        throw new Error('blueBriX verified first-party careers page no longer matches the trusted public surface')
      }
      listingUrl = urls[0]
      careersHtml = await fetchText(listingUrl)
    }
    const jobs = extractJobCards(careersHtml)
    const currentListing = listingUrl !== CAREERS_URL
    let publishedTotal = null
    if (currentListing) {
      const counts = [...careersHtml.matchAll(/<div\b[^>]*class=["']job-roles-card-left["'][^>]*>([\s\S]*?)<\/div>/gi)]
        .map(match => Number(normalizeText(match[1])?.match(/\b(\d+)\s+positions?\b/i)?.[1]))
      publishedTotal = counts.reduce((sum, count) => sum + count, 0)
      if (!counts.length || counts.some(count => !Number.isSafeInteger(count) || count < 0)
        || publishedTotal !== extractCurrentRoleCards(careersHtml).length) {
        throw new Error('blueBriX native inventory disagrees with its published department counts')
      }
      for (const job of jobs) {
        const url = new URL(job.sourceUrl)
        if (url.origin !== new URL(CAREERS_URL).origin || !/^\/roles\/[^/]+\/$/.test(url.pathname)) {
          throw new Error('blueBriX role link left the verified first-party careers host')
        }
        const html = await fetchText(job.sourceUrl)
        const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
        const headings = [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map(match => normalizeText(match[1]))
        const sections = [...html.matchAll(/<section\b[^>]*class=["'][^"']*\bjob-description-section\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi)]
        const description = sections.length === 1 ? normalizeText(sections[0][1]) : null
        if (canonical !== job.sourceUrl || !headings.includes(job.title) || !description) {
          throw new Error('blueBriX complete first-party role detail changed: ' + job.sourceUrl)
        }
        job.jobDescription = description
      }
    }

    const mapped = jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
    if (!currentListing) return mapped
    return attachInventoryEvidence(mapped, { status: 'complete-inventory', surface: listingUrl,
      firstParty: true, listingComplete: true, pagesFetched: 1,
      reportedTotal: publishedTotal, indiaFacetCount: jobs.length,
      verifiedAt: now(), reason: 'employer-published-all-roles-page-and-full-first-party-role-details' })
  },
})

export const run = async (options = {}) => createBlueBrixScraper().run(options)

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
