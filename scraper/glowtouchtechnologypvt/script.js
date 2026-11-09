import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'glowtouchtechnologypvt'
export const COMPANY_NAME = 'Glowtouch Technology Pvt'
export const CAREERS_URL = 'https://www.glowtouch.com/careers/'
export const TRUSTED_APPLY_URL = 'mailto:talenthire.india@glowtouch.com'

const TRUSTED_HRONE_HOST = 'career.hrone.cloud'
const TRUSTED_HRONE_PATH = '/career-portal'
const TRUSTED_HRONE_DC = 'diya'
const TRUSTED_CAREERS_HOSTS = new Set(['glowtouch.com', 'www.glowtouch.com'])
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HTML_ENTITY_MAP = new Map([
  ['&nbsp;', ' '],
  ['&amp;', '&'],
  ['&quot;', '"'],
  ['&apos;', "'"],
  ['&#39;', "'"],
  ['&rsquo;', "'"],
  ['&lsquo;', "'"],
  ['&rdquo;', '"'],
  ['&ldquo;', '"'],
  ['&ndash;', '-'],
  ['&mdash;', '-'],
  ['&hellip;', '...'],
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([a-f0-9]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITY_MAP.get(entity) ?? entity)

const stripHtml = (value) => decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeWhitespace = (value) => stripHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const trimTrailingPunctuation = (value) => normalizeWhitespace(value).replace(/[.;:\s]+$/g, '')

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const isTrustedCareerDetailUrl = (value) => {
  try {
    const url = new URL(value)
    return TRUSTED_CAREERS_HOSTS.has(url.hostname)
      && url.protocol === 'https:'
      && url.pathname !== '/'
      && url.pathname !== '/careers/'
  } catch {
    return false
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const extractEmbeddedHrOneUrl = (html) => {
  const match = String(html ?? '').match(
    /<iframe[^>]+src="([^"]*career\.hrone\.cloud\/career-portal[^"]+)"/i,
  )

  return match ? decodeHtmlEntities(match[1]) : null
}

export const isTrustedEmbeddedHrOneUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname === TRUSTED_HRONE_HOST
      && url.pathname === TRUSTED_HRONE_PATH
      && url.searchParams.get('dc') === TRUSTED_HRONE_DC
      && Boolean(url.searchParams.get('appId'))
      && Boolean(url.searchParams.get('rqt'))
      && Boolean(url.searchParams.get('cc'))
  } catch {
    return false
  }
}

export const extractIndiaRoleLinks = (html) => {
  const matches = String(html ?? '').matchAll(
    /<article[^>]*category-jobs-india[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi,
  )
  const seenUrls = new Set()
  const roles = []

  for (const match of matches) {
    const url = toAbsoluteUrl(match[1])
    const title = normalizeWhitespace(match[2])

    if (!title || !url || !isTrustedCareerDetailUrl(url) || seenUrls.has(url)) {
      continue
    }

    seenUrls.add(url)
    roles.push({ title, url })
  }

  return roles
}

export const hasOfficialCareersSignal = (html) => {
  const source = String(html ?? '')

  return /Careers\s*\|\s*GlowTouch LLC/i.test(source)
    && /India Opportunities/i.test(source)
    && /Join our dynamic, fast growing team working to help our clients succeed!/i.test(source)
    && /category-jobs-india/i.test(source)
    && /talenthire\.india@glowtouch\.com/i.test(source)
    && isTrustedEmbeddedHrOneUrl(extractEmbeddedHrOneUrl(source))
    && extractIndiaRoleLinks(source).length > 0
}

const extractSectionParagraph = (html, headingText) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<h2[^>]*>\\s*${escapeRegex(headingText)}\\s*<\\/h2>[\\s\\S]*?<p>([\\s\\S]*?)<\\/p>`,
      'i',
    ),
  )

  return match ? trimTrailingPunctuation(match[1]) : null
}

const extractSectionItems = (html, headingText) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<h2[^>]*>\\s*${escapeRegex(headingText)}\\s*<\\/h2>[\\s\\S]*?<ul[^>]*>([\\s\\S]*?)<\\/ul>`,
      'i',
    ),
  )

  if (!match) return []

  return Array.from(
    match[1].matchAll(
      /<span[^>]*class="[^"]*elementor-icon-list-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    ),
  )
    .map((item) => trimTrailingPunctuation(item[1]))
    .filter(Boolean)
}

const extractFirstMatchingParagraph = (html, headingCandidates) => {
  for (const headingText of headingCandidates) {
    const paragraph = extractSectionParagraph(html, headingText)
    if (paragraph) {
      return paragraph
    }
  }

  return null
}

const extractCombinedSectionItems = (html, headingCandidates) => {
  const seenItems = new Set()
  const items = []

  for (const headingText of headingCandidates) {
    for (const item of extractSectionItems(html, headingText)) {
      if (!item || seenItems.has(item)) continue
      seenItems.add(item)
      items.push(item)
    }
  }

  return items
}

const extractPostingDate = (html) => {
  const match = String(html ?? '').match(
    /<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i,
  )

  return match ? normalizeWhitespace(match[1]) : null
}

const extractApplyUrl = (html) => {
  const match = String(html ?? '').match(/href="(mailto:talenthire\.india@glowtouch\.com)"/i)
  return match ? match[1].toLowerCase() : null
}

const inferLocation = (aboutCompany, summary) => {
  const combined = `${aboutCompany || ''} ${summary || ''}`
  return /\bindia\b/i.test(combined) ? 'India' : null
}

const inferExperienceRequired = (summary, requiredSkills) => {
  const combined = [summary, ...(Array.isArray(requiredSkills) ? requiredSkills : [])]
    .filter(Boolean)
    .join(' ')
  const match = combined.match(/\b\d+\+?\s*years?\b/i)
  return match ? normalizeWhitespace(match[0]) : null
}

const buildJobDescription = ({
  summary,
  skills,
  attributes,
}) => {
  const parts = []

  if (summary) {
    parts.push(`Summary of Position: ${trimTrailingPunctuation(summary)}.`)
  }

  if (Array.isArray(skills) && skills.length > 0) {
    parts.push(`Skills and Responsibilities: ${skills.map(trimTrailingPunctuation).join('; ')}.`)
  }

  if (Array.isArray(attributes) && attributes.length > 0) {
    parts.push(`Attributes: ${attributes.map(trimTrailingPunctuation).join('; ')}.`)
  }

  return parts.join(' ') || null
}

export const extractJobDetail = ({ detailUrl, html }) => {
  if (!isTrustedCareerDetailUrl(detailUrl)) {
    throw new Error('Glowtouch Technology Pvt detail page is outside the trusted first-party domain')
  }

  const titleMatch = String(html ?? '').match(/<h2[^>]*>\s*([^<]+?)\s*<\/h2>/i)
  const title = titleMatch ? normalizeWhitespace(titleMatch[1]) : null
  const aboutCompany = extractSectionParagraph(html, 'About Company:')
  const summary = extractFirstMatchingParagraph(html, [
    'Summary of Position:',
    'Our Vision',
  ])
  const skills = extractCombinedSectionItems(html, [
    'Skills and Responsibilities:',
    'What you will do',
    'What is your learning',
    'Eligibility Criteria: ( what you need to have )',
  ])
  const attributes = extractCombinedSectionItems(html, [
    'Attributes',
    'Education and other attributes',
  ])
  const applyUrl = extractApplyUrl(html)

  if (!title || !summary) {
    throw new Error('Glowtouch Technology Pvt detail page no longer exposes the verified role content')
  }

  if (applyUrl !== TRUSTED_APPLY_URL) {
    throw new Error('Glowtouch Technology Pvt detail page no longer exposes the trusted apply route')
  }

  const location = inferLocation(aboutCompany, summary)
  const slug = slugify(title)
  const requiredSkills = [...skills, ...attributes]

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location,
    city: null,
    country: 'India',
    jobId: `${SOURCE}-${slug}`,
    requisitionId: `${SOURCE}-${slug}`,
    sourceUrl: detailUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: inferExperienceRequired(summary, requiredSkills),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: extractPostingDate(html),
    closingDate: null,
    jobDescription: buildJobDescription({
      summary,
      skills,
      attributes,
    }),
  }
}

export const createGlowtouchTechnologyPvtScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Glowtouch Technology Pvt careers page no longer matches the verified official careers surface')
    }

    const hroneUrl = extractEmbeddedHrOneUrl(careersHtml)
    if (!isTrustedEmbeddedHrOneUrl(hroneUrl)) {
      throw new Error('Glowtouch Technology Pvt careers page no longer embeds the trusted HROne board')
    }

    const roleLinks = extractIndiaRoleLinks(careersHtml)
    if (roleLinks.length === 0) {
      throw new Error('Glowtouch Technology Pvt careers page no longer exposes the verified India role links')
    }

    const selectedRoleLinks = Number.isInteger(maxJobs) && maxJobs > 0
      ? roleLinks.slice(0, maxJobs)
      : roleLinks

    const jobs = []
    for (const role of selectedRoleLinks) {
      const detailHtml = await fetchText(role.url)
      jobs.push(extractJobDetail({
        detailUrl: role.url,
        html: detailHtml,
      }))
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createGlowtouchTechnologyPvtScraper().run(options)

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
