import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kathirsudhirautomation'
export const COMPANY = 'Kathir Sudhir Automation'
export const HOMEPAGE_URL = 'https://www.kathirsudhirautomation.com/'
export const CAREERS_URL = 'https://www.kathirsudhirautomation.com/career'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_CAREERS_LINK_PATTERN =
  /href=["'](?:https?:\/\/www\.kathirsudhirautomation\.com)?\/career\/?["'][^>]*>\s*Career\s*<\/a>/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '')).replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const cleanJobTitle = (value) => normalizeWhitespace(stripTags(value))
  .replace(/^\d+\.\s*/i, '')
  .replace(/^Job Title:\s*/i, '')

const extractTextAfterLabel = (blockHtml, label) => {
  const paragraphs = [...String(blockHtml ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
  const normalizedLabel = normalizeWhitespace(label).replace(/\s*[:\-]\s*$/u, '').toLowerCase()

  for (let index = 0; index < paragraphs.length - 1; index += 1) {
    const paragraphLabel = normalizeWhitespace(paragraphs[index])
      .replace(/\s*[:\-]\s*$/u, '')
      .toLowerCase()

    if (paragraphLabel === normalizedLabel) {
      return paragraphs[index + 1]
    }
  }

  return ''
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractResponsibilities = (blockHtml) => {
  const listItems = extractListItems(blockHtml)
  if (listItems.length > 0) return listItems

  const match = String(blockHtml ?? '').match(
    /Roles and Responsibilities[\s\S]*?<\/p>([\s\S]*?)<p\b[^>]*>[\s\S]*?Experience/i,
  )

  if (!match) return []

  return [...match[1].matchAll(/<(?:div|p)\b[^>]*>([\s\S]*?)<\/(?:div|p)>/gi)]
    .map((segment) => stripTags(segment[1]).replace(/^[>\-•]+\s*/u, ''))
    .filter(Boolean)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return (/<title>\s*Kathir Sudhir Automation Solution_\s*Home\s*<\/title>/i.test(page)
      || /<title>\s*Kathir Sudhir Automation India\s*[—–-]\s*Electronics Instruments Manufacturer\s*&\s*System Integrator for Automation Solutions\s*<\/title>/i.test(decodeHtmlEntities(page)))
    && /Kathir Sudhir Automation India Pvt Ltd/i.test(text)
    && /Electronics Instruments Manufacturer\s*&\s*System Integrator for Automation Solutions/i.test(text)
    && HOMEPAGE_CAREERS_LINK_PATTERN.test(page)
    && /hr@kathirsudhirautomation\.com/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page).toLowerCase()

  const hasStableCareersIdentity = (/<title>\s*Career opportunities in Electronics Core Company in Chennai\s*<\/title>/i.test(page)
      || /<title>\s*career\s*[—–-]\s*Kathir Sudhir Automation India\s*<\/title>/i.test(decodeHtmlEntities(page)))
    && text.includes('electronics core company jobs')
    && /hr@kathirsudhirautomation\.com/i.test(page)

  const hasLegacyJobSections = /Job Title:/i.test(page) && /apply here/i.test(page)
  const hasCurrentNoListingsSurface = /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.kathirsudhirautomation\.com\/career["']/i.test(page)
    && /["']@type["']\s*:\s*["']Organization["']/i.test(page)
    && /["']name["']\s*:\s*["']Kathir Sudhir Automation India Pvt Ltd["']/i.test(page)
    && /<h1\b[^>]*>\s*Career\s*<\/h1>/i.test(page)
    && /For Job\s*:/i.test(page)

  const hasCurrentInlineCareersSurface = /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.kathirsudhirautomation\.com\/career["']/i.test(page)
    && /Kathir Sudhir Automation India Pvt Ltd/i.test(text)
    && /<h1\b[^>]*>\s*Career\s*<\/h1>/i.test(page)
    && /Open Positions\s*[—–-]\s*Kathir Sudhir Automation/i.test(page)
    && /const\s+jobs\s*=\s*\[/i.test(page)
    && /For Job\s*:/i.test(page)

  return hasStableCareersIdentity && (hasLegacyJobSections || hasCurrentNoListingsSurface || hasCurrentInlineCareersSurface)
}

const JOB_SECTION_PATTERN =
  /<h3\b[^>]*>([\s\S]*?Job Title:[\s\S]*?)<\/h3>([\s\S]*?)<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?apply here[\s\S]*?<\/a>/gi

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Kathir Sudhir Automation verified careers page no longer matches the known public first-party surface')
  }

  if (!/Job Title:|apply here/i.test(String(html ?? ''))) {
    const hasInlineJobs = /const\s+jobs\s*=\s*\[/i.test(html)
    throw Object.assign(new Error(hasInlineJobs ? 'Kathir Sudhir Automation job geography is unverified: current inline role geography has not been validated' : 'Kathir Sudhir Automation public inventory is unavailable: a generic careers page does not prove zero openings'), {
      code: hasInlineJobs ? 'KATHIR_LOCATION_UNVERIFIED' : 'KATHIR_INVENTORY_UNAVAILABLE',
      softFailure: true,
      failureKind: hasInlineJobs ? 'upstream_scope_unverified' : 'upstream_inventory_unavailable',
      abortRetries: true,
    })
  }

  const jobs = [...String(html ?? '').matchAll(JOB_SECTION_PATTERN)].map((match) => {
    const rawTitle = match[1]
    const blockHtml = match[2]
    const applyUrl = buildAbsoluteUrl(match[3])
    const title = cleanJobTitle(rawTitle)
    const minimumQualification = extractTextAfterLabel(blockHtml, 'Qualifications') || null
    const experienceRequired = extractTextAfterLabel(blockHtml, 'Experience') || null
    const salary = extractTextAfterLabel(blockHtml, 'Salary range') || null
    const jobDescription = extractResponsibilities(blockHtml).join(' ') || null
    const jobId = `${SOURCE}-${slugify(`${title}-chennai`)}`

    if (!title || !applyUrl || !jobDescription || !jobId) {
      throw new Error('Kathir Sudhir Automation verified careers job sections changed shape')
    }

    return {
      title,
      company: COMPANY,
      department: null,
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: `${CAREERS_URL}#${jobId}`,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: salary ? `${jobDescription} Salary: ${salary}` : jobDescription,
    }
  })

  if (jobs.length !== 5) {
    throw new Error('Kathir Sudhir Automation verified careers job sections changed shape')
  }

  return jobs.sort((left, right) => left.title.localeCompare(right.title))
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createKathirSudhirAutomationScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow, signal } = {}) {
    signal?.throwIfAborted()
    const read = async url => { signal?.throwIfAborted(); const value = await fetchText(url, { signal }); signal?.throwIfAborted(); return value }
    const homepageHtml = await read(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Kathir Sudhir Automation verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await read(CAREERS_URL)
    let jobs
    try {
      jobs = extractPublicJobs(careersHtml)
    } catch (error) {
      if (
        error?.code === 'KATHIR_LOCATION_UNVERIFIED'
        || error?.code === 'KATHIR_INVENTORY_UNAVAILABLE'
      ) {
        return attachInventoryEvidence([], {
          status: 'discovery-only',
          surface: CAREERS_URL,
          firstParty: true,
          listingComplete: false,
          pagesFetched: 2,
          reportedTotal: null,
          indiaFacetCount: null,
          verifiedAt: (overrideNow || now)(),
          reason: error.message,
        })
      }

      throw error
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'kathirsudhirautomation.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createKathirSudhirAutomationScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  const inventoryEvidence = readInventoryEvidence(jobs)
  if (inventoryEvidence?.listingComplete === false) {
    if (isDryRun) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path.join(currentDir, 'inventory-evidence.json'), JSON.stringify(inventoryEvidence, null, 2))
    }
    console.error(inventoryEvidence.reason)
    process.exitCode = 1
  } else if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
