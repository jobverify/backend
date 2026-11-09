import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kreetitechnologies'
export const COMPANY = 'Kreeti Technologies'
export const HOMEPAGE_URL = 'https://www.kreeti.com/'
export const CAREERS_HOME_URL = 'https://careers.kreeti.com/'
export const CANDIDATES_URL = 'https://careers.kreeti.com/candidates'

const COMPANY_DOMAIN = 'kreeti.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8217;|&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\r\n?/g, '\n')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ),
)

const toAbsoluteUrl = (value, baseUrl = CANDIDATES_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractCardBody = (html, heading) => {
  const pattern = new RegExp(
    `<div class="card-header">\\s*${escapeRegExp(heading)}\\s*<\\/div>\\s*<div class="card-body">([\\s\\S]*?)<\\/div>`,
    'i',
  )
  return pattern.exec(String(html ?? ''))?.[1] || ''
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractParagraphs = (html) => [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractLabeledListItems = (html, label) => {
  const pattern = new RegExp(
    `<p[^>]*>\\s*(?:<strong>|<em>)?\\s*${escapeRegExp(label)}\\s*:?(?:<\\/strong>|<\\/em>)?\\s*<\\/p>\\s*(<ul>[\\s\\S]*?<\\/ul>)`,
    'i',
  )
  return extractListItems(pattern.exec(String(html ?? ''))?.[1] || '')
}

const extractExperience = (html) =>
  normalizeWhitespace(String(html ?? '').match(/Exp:\s*([^|<]+)/i)?.[1] ?? '') || null

const buildDetailUrl = (jobId) => toAbsoluteUrl(`/jobs/${jobId}`, CANDIDATES_URL)
const buildApplyUrl = (jobId) => toAbsoluteUrl(`/candidates/new?job_id=${jobId}`, CANDIDATES_URL)

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  const hasLegacyIdentity = /<title>\s*Web Development and Custom Application Development Company\s*<\/title>/i.test(page)
    && /150\+\s*Successful Projects/i.test(text)
  const hasCurrentIdentity = /<title>[^<]*Kreeti Technologies[^<]*<\/title>/i.test(page)
    && /\bSuccessful Projects\b/i.test(text)
    && /\bYears of Excellence\b/i.test(text)

  return /Kreeti Technologies/i.test(text)
    && (hasLegacyIdentity || hasCurrentIdentity)
    && /href="https:\/\/careers\.kreeti\.com\/candidates"/i.test(page)
}

export const hasOfficialCareersHomeSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Kreeti Technologies\s*<\/title>/i.test(page)
    && /href="\/candidates"/i.test(page)
    && /href="\/life_at_kreeti"/i.test(page)
    && /At Kreeti, we believe in leadership at every level/i.test(text)
    && /Join Our Team/i.test(text)
}

export const hasOfficialCandidatesSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Kreeti Technologies\s*<\/title>/i.test(page)
    && /LET US KNOW THAT YOU ARE INTERESTED/i.test(text)
    && /<form[^>]+class="new_candidate"[^>]+action="\/candidates"/i.test(page)
    && /name="job\[job_id\]"/i.test(page)
    && /Select Position/i.test(text)
}

export const extractListings = (html) => {
  if (!hasOfficialCandidatesSignal(html)) throw new Error('Kreeti Technologies verified candidate jobs page changed materially')
  const page = String(html ?? '')
  const opening = [...page.matchAll(/<section\b[^>]*class=["']([^"']*)["'][^>]*>/gi)]
    .find(match => match[1].split(/\s+/).includes('jobs'))
  if (!opening) throw new Error('Kreeti Technologies active openings section is incomplete')
  const tags = /<\/?section\b[^>]*>/gi
  tags.lastIndex = opening.index + opening[0].length
  let depth = 1
  let closing
  while (depth && (closing = tags.exec(page))) depth += closing[0].startsWith('</') ? -1 : 1
  if (depth) throw new Error('Kreeti Technologies active openings section is incomplete')
  const activeSection = page.slice(opening.index + opening[0].length, closing.index)
  const explicitlyEmpty = [...activeSection.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .some(match => /^No Open Positions$/i.test(stripTags(match[1])))
  const activeLinks = /<a\b[^>]*href=["'][^"']*\/jobs\/\d+/i.test(activeSection)
  if (explicitlyEmpty && !activeLinks) return []
  // The separate general-interest select is not evidence that a vacancy is open.
  // A future active section needs a verified listing parser before it can be a snapshot.
  throw new Error('Kreeti Technologies candidate jobs page has ambiguous or contradictory active openings')
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const title = stripTags(page.match(/<h3 class="job-details-header__title">([\s\S]*?)<\/h3>/i)?.[1] ?? '')
  const applyUrl = toAbsoluteUrl(
    page.match(/href="([^"]*\/candidates\/new\?job_id=\d+)"/i)?.[1] ?? null,
    CANDIDATES_URL,
  )
  const jobDescriptionHtml = extractCardBody(page, 'Job Description')
  const requiredSkillsHtml = extractCardBody(page, 'Required Skills')
  const qualificationHtml = extractCardBody(page, 'Qualification')

  if (
    !title
    || !applyUrl
    || !jobDescriptionHtml
    || !requiredSkillsHtml
    || !qualificationHtml
    || !/Apply Now/i.test(page)
    || normalizeWhitespace(title) !== normalizeWhitespace(listing.title)
  ) {
    throw new Error('Kreeti Technologies verified first-party detail page changed materially')
  }

  const descriptionParts = [
    ...extractParagraphs(jobDescriptionHtml),
    ...extractListItems(jobDescriptionHtml),
  ]
  const requiredSkills = [
    ...extractListItems(requiredSkillsHtml),
    ...extractLabeledListItems(jobDescriptionHtml, 'Must Have Skills'),
  ]

  return {
    ...listing,
    title,
    sourceUrl: listing.sourceUrl || buildDetailUrl(listing.jobId),
    applyUrl,
    experienceRequired: extractExperience(page),
    minimumQualification: extractListItems(qualificationHtml)[0] || null,
    requiredSkills: [...new Set(requiredSkills.filter(Boolean))],
    jobDescription: descriptionParts.join(' '),
  }
}

export const createKreetiTechnologiesScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal } = {}) {
    signal?.throwIfAborted()
    const homepageHtml = await fetchText(HOMEPAGE_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Kreeti Technologies verified official homepage no longer matches the known public surface')
    }

    const careersHomeHtml = await fetchText(CAREERS_HOME_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCareersHomeSignal(careersHomeHtml)) {
      throw new Error('Kreeti Technologies verified first-party careers home no longer matches the known public surface')
    }

    const candidatesHtml = await fetchText(CANDIDATES_URL, { signal })
    signal?.throwIfAborted()
    const listings = extractListings(candidatesHtml)
    if (listings.length === 0) {
      return []
    }

    const selectedListings = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings

    return Promise.all(selectedListings.map(async (listing) => {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      return normalizeScrapedJob({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        companyCareerPage: CANDIDATES_URL,
        atsPlatform: 'official-company-careers',
        scrapedAt: now(),
      }, {
        companyName: COMPANY,
        companyCareerPage: CANDIDATES_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        countryFilter: 'India',
      })
    }))
  },
})

export const run = async (options = {}) => createKreetiTechnologiesScraper().run(options)

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
