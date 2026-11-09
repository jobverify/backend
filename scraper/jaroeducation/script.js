import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jaroeducation'
export const COMPANY = 'Jaro Education'
export const HOMEPAGE_URL = 'https://www.jaroeducation.com/'
export const CAREERS_URL = 'https://www.jaroeducation.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '')).replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toDisplayTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (normalized !== normalized.toLowerCase()) return normalized

  return normalized.replace(/\b[a-z]/g, (character) => character.toUpperCase())
}

const absoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const hasQualificationSignal = (value) =>
  /\b(bachelor|master|mba|pgdm|degree|diploma|graduat|b\.?tech|m\.?tech|b\.?e\.?|mca|related field)\b/i.test(
    normalizeWhitespace(value),
  )

const extractFirstHeading = (html) => toDisplayTitle(
  stripTags(html.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]),
)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractSection = (html, label) => {
  const pattern = new RegExp(
    `<h[1-6]\\b[^>]*>\\s*${escapeRegExp(label)}\\s*<\\/h[1-6]>\\s*([\\s\\S]*?)(?=<h[1-6]\\b|<\\/article>|<\\/section>|<article\\b|<section\\b|$)`,
    'i',
  )

  return pattern.exec(String(html ?? ''))?.[1] || ''
}

const buildJobId = ({ title, location }) => `jaroeducation-${slugify(`${title}-${location}`)}`

const parseLocation = (items = []) => {
  const cleaned = items.map((item) => normalizeWhitespace(item)).filter(Boolean)

  if (cleaned.length === 0) {
    return {
      location: 'India',
      city: null,
    }
  }

  return {
    location: `${cleaned.join(', ')}, India`,
    city: cleaned.length === 1 ? cleaned[0] : null,
  }
}

const splitQualificationsAndSkills = (items = []) => {
  const minimum = []
  const preferred = []
  const skills = []

  for (const item of items.map((value) => normalizeWhitespace(value)).filter(Boolean)) {
    if (hasQualificationSignal(item)) {
      if (/preferred|optional/i.test(item) && preferred.length === 0) {
        preferred.push(item)
      } else if (minimum.length === 0) {
        minimum.push(item)
      } else {
        preferred.push(item)
      }
      continue
    }

    skills.push(item)
  }

  return {
    minimumQualification: minimum[0] || null,
    preferredQualification: preferred[0] || null,
    requiredSkills: skills,
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title[^>]*>\s*Most trusted Online Higher Education Company\s*\|\s*Jaro Education\s*<\/title>/i.test(page)
    && (
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Jaro Education["']/i.test(page)
      || /<meta[^>]+name=["']author["'][^>]+content=["']Jaro Education["']/i.test(page)
      || /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.jaroeducation\.com\/["']/i.test(page)
    )
    && text.includes('Career Transformed')
    && text.includes('Jaro Education')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page).toLowerCase()

  return /<title[^>]*>\s*Career at Jaro Education\s*\|\s*Jaro Education\s*<\/title>/i.test(page)
    && text.includes('why join jaro education?')
    && text.includes('explore current opportunities')
    && text.includes('find jobs')
    && /apply now/i.test(page)
    && /view details/i.test(page)
}

const extractAccordionBlocks = (html) => {
  const page = String(html ?? '')
  const marker = /<div class="accordion-item">/gi
  const matches = [...page.matchAll(marker)]
  if (matches.length === 0) return []

  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? page.length
    return page.slice(start, end)
  })
}

const extractLegacyJobBlocks = (html) => [...String(html ?? '').matchAll(
  /<(article|section|div)\b[^>]*class=["'][^"']*\bjob-opening\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi,
)].map((match) => match[2])

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Jaro Education verified official careers surface changed or disappeared')
  }

  const blockHtmlList = extractLegacyJobBlocks(html)
  const blocks = blockHtmlList.length > 0 ? blockHtmlList : extractAccordionBlocks(html)

  const jobs = blocks.map((blockHtml) => {
    const title = extractFirstHeading(blockHtml)
    const explicitApplyUrl = absoluteUrl(
      blockHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1],
    )

    const locationItems = extractListItems(extractSection(blockHtml, 'Location'))
    const experienceRequired = extractListItems(extractSection(blockHtml, 'Experience'))[0] || null
    const descriptionItems = extractListItems(extractSection(blockHtml, 'Job Description'))
    const skillSectionLabel = /<h[1-6]\b[^>]*>\s*Required Skills\s*&?\s*Qualifications\s*<\/h[1-6]>/i.test(blockHtml)
      ? 'Required Skills & Qualifications'
      : (/<h[1-6]\b[^>]*>\s*Required Skills\s*<\/h[1-6]>/i.test(blockHtml)
        ? 'Required Skills'
        : null)
    const qualificationSectionLabel = /<h[1-6]\b[^>]*>\s*Educational Qualifications\s*<\/h[1-6]>/i.test(blockHtml)
      ? 'Educational Qualifications'
      : (/<h[1-6]\b[^>]*>\s*Required Qualifications\s*<\/h[1-6]>/i.test(blockHtml)
        ? 'Required Qualifications'
        : null)

    let minimumQualification = null
    let preferredQualification = null
    let requiredSkills = []

    if (skillSectionLabel) {
      const skillItems = extractListItems(extractSection(blockHtml, skillSectionLabel))

      if (skillSectionLabel === 'Required Skills & Qualifications') {
        const splitResult = splitQualificationsAndSkills(skillItems)
        minimumQualification = splitResult.minimumQualification
        preferredQualification = splitResult.preferredQualification
        requiredSkills = splitResult.requiredSkills
      } else {
        requiredSkills = skillItems
      }
    }

    if (qualificationSectionLabel) {
      const qualificationItems = extractListItems(extractSection(blockHtml, qualificationSectionLabel))

      minimumQualification = qualificationItems.find(hasQualificationSignal) || qualificationItems[0] || minimumQualification
      preferredQualification = qualificationItems.find((item) => /preferred|optional/i.test(item))
        || preferredQualification
      if (qualificationSectionLabel === 'Required Qualifications' && !skillSectionLabel) {
        requiredSkills = qualificationItems.filter((item) => !hasQualificationSignal(item))
      }
    }
    const locationInfo = parseLocation(locationItems)
    const jobId = buildJobId({
      title,
      location: locationItems.join('-') || locationInfo.city || locationInfo.location,
    })
    const defaultJobUrl = `${CAREERS_URL}#${jobId}`
    const applyUrl = explicitApplyUrl || defaultJobUrl

    if (!title || !applyUrl || !locationInfo.location) {
      throw new Error('Jaro Education verified careers surface changed or disappeared')
    }

    return {
      title,
      company: COMPANY,
      department: null,
      location: locationInfo.location,
      city: locationInfo.city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: defaultJobUrl,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification,
      preferredQualification,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: descriptionItems.join(' '),
    }
  })

  if (jobs.length === 0) {
    throw new Error('Jaro Education verified careers surface changed or disappeared')
  }

  return jobs
    .sort((left, right) => (
      left.title.localeCompare(right.title)
      || left.location.localeCompare(right.location)
    ))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createJaroEducationScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Jaro Education verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicListings(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'jaroeducation.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createJaroEducationScraper().run(options)

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
