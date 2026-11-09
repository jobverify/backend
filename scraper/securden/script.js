import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'securden'
export const COMPANY = 'Securden'
export const CAREERS_URL = 'https://www.securden.com/careers/'
export const LINKEDIN_COMPANY_URL = 'https://www.linkedin.com/company/securden-inc/'
export const MISSING_ROUTE_URLS = [
  'https://www.securden.com/jobs/',
  'https://www.securden.com/company/careers/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const firstMatch = (html, pattern) => normalizeWhitespace(String(html ?? '').match(pattern)?.[1]) || null

export const hasUnexpectedPublicJobsSignal = (html = '') => /"@type"\s*:\s*"JobPosting"/i.test(String(html ?? ''))
  || /https?:\/\/[^"' ]*(jobs\.lever\.co|greenhouse|myworkdayjobs|workdayjobs|darwinbox|ashbyhq|smartrecruiters|jobvite|freshteam|cutshort)/i.test(String(html ?? ''))

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Careers At Securden | Opportunities in Cybersecurity'
    && text.includes('Opportunities in Cybersecurity')
    && page.includes(LINKEDIN_COMPANY_URL)
}

export const isVerifiedMissingRoute = ({ status, html }) => {
  return status === 404
    && extractTitle(html) === 'Page Not Found | Securden'
}

export const extractJobCards = (html = '') => {
  const cards = [...String(html ?? '').matchAll(
    /<div class="col-lg-6 career-box">[\s\S]*?<p class="h4">([\s\S]*?)<\/p>[\s\S]*?<p class="pr-4 career-box-content">([\s\S]*?)<\/p>[\s\S]*?<img src="\.\.\/images\/map\.png" alt="location"\/?>([\s\S]*?)<\/span>[\s\S]*?<img src="\.\.\/images\/time\.png" alt="Time"\/?>([\s\S]*?)<\/span>[\s\S]*?<div class="career-view-more"><a href="([^"]+)">View more<\/a>/gi,
  )]
    .map((match) => ({
      title: normalizeWhitespace(match[1]),
      summary: normalizeWhitespace(match[2]),
      location: normalizeWhitespace(match[3]),
      employmentType: normalizeWhitespace(match[4]),
      detailUrl: new URL(match[5], CAREERS_URL).href,
    }))
    .filter((card) => card.title && card.summary && card.location && card.employmentType && card.detailUrl)

  return [...new Map(cards.map((card) => [card.detailUrl, card])).values()]
}

const extractDescription = (html = '') => {
  const content = String(html ?? '').match(
    /<section[^>]*career-details-content[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i,
  )?.[1]

  return normalizeWhitespace(content)
}

const extractExperience = (html = '') => firstMatch(
  html,
  /<p[^>]*>\s*<b>\s*Experience\s*<\/b>\s*:\s*([\s\S]*?)<\/p>/i,
)

const extractLocation = (html = '') => firstMatch(
  html,
  /<p[^>]*>\s*<b>\s*Location\s*<\/b>\s*:\s*([\s\S]*?)<\/p>/i,
)

const extractApplyEmail = (html = '') => {
  const mailtoMatch = String(html ?? '').match(/mailto:([\w.+-]+@securden\.com)/i)?.[1]
  if (mailtoMatch) {
    return mailtoMatch.toLowerCase()
  }

  const plainMatch = String(html ?? '').match(/([\w.+-]+@securden\.com)/i)?.[1]
  return plainMatch ? plainMatch.toLowerCase() : null
}

const extractHeadingTitle = (html = '') => firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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

const parseDetailPage = ({ html, url, card }) => {
  const title = extractHeadingTitle(html)
  const description = extractDescription(html)
  const location = extractLocation(html) || card.location
  const employmentType = firstMatch(
    html,
    /<img src="\.\.\/images\/time\.png" alt="Time"\/?>[\s\S]*?<p>([\s\S]*?)<\/p>/i,
  ) || card.employmentType
  const applyEmail = extractApplyEmail(html)
  const experienceRequired = extractExperience(html)
  const jobId = new URL(url).pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/i, '')

  if (!title || !description || !location || !employmentType || !applyEmail || !jobId) {
    throw new Error(`The verified Securden detail page changed materially: ${url}`)
  }

  if (normalizeWhitespace(title) !== normalizeWhitespace(card.title)) {
    throw new Error(`The verified Securden detail page changed materially: ${url}`)
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location: `${location}, India`,
    city: location,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: url,
    applyUrl: `mailto:${applyEmail}`,
    employmentType,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    remoteStatus: null,
    source: SOURCE,
    link: `mailto:${applyEmail}`,
  }
}

export const createSecurdenScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (hasUnexpectedPublicJobsSignal(careersPage.html)) {
      throw new Error('The verified Securden careers page now appears to expose a public jobs surface')
    }

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {

      throw new Error('The verified Securden careers page changed materially')
    }

    const jobCards = extractJobCards(careersPage.html)
    if (jobCards.length === 0) {
      throw new Error('The verified Securden careers page changed materially')
    }

    const jobs = []
    for (const card of jobCards) {
      const detailPage = await fetchPage(card.detailUrl)
      if (detailPage.status !== 200 || detailPage.url !== card.detailUrl) {
        throw new Error(`The verified Securden detail page changed materially: ${card.detailUrl}`)
      }

      jobs.push(parseDetailPage({
        html: detailPage.html,
        url: detailPage.url,
        card,
      }))
    }

    for (const routeUrl of MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage)) {
        throw new Error(`The verified Securden missing-route contract changed for ${routeUrl}`)
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createSecurdenScraper().run(options)

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
