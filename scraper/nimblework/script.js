import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nimblework'
export const COMPANY = 'Nimble Work, Inc'
export const COMPANY_DOMAIN = 'nimblework.com'
export const HOMEPAGE_URL = 'https://www.nimblework.com/'
export const CAREERS_URL = 'https://www.nimblework.com/careers/'
export const CURRENT_OPENINGS_URL = 'https://www.nimblework.com/careers/current-openings/'

const ATS_PLATFORM = 'official-company-careers'
const APPLY_EMAIL = 'careers@nimblework.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
    signal: createTimeoutSignal(45000),
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

const createFetchPageFromText = (fetchText) => async (url) => ({
  status: 200,
  url,
  html: await fetchText(url),
})

const SECTION_DEFINITIONS = [
  { key: 'jobRequirements', label: 'Job Requirements' },
  { key: 'productManagerResponsibilities', label: 'Product Manager responsibilities include' },
  { key: 'qualities', label: 'We are looking for following qualities in you' },
  { key: 'requiredSkills', label: 'Required Skills' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'requisites', label: 'Requisites' },
  { key: 'technicalToolsSkillRequirement', label: 'Technical/Tools Skill Requirement' },
  { key: 'technicalSkills', label: 'Technical Skills' },
  { key: 'keySkills', label: 'Key Skills' },
  { key: 'experience', label: 'Experience' },
  { key: 'educationQualification', label: 'Education Qualification' },
  { key: 'mustHave', label: 'Must-Have' },
  { key: 'goodToHave', label: 'Good To Have' },
  { key: 'howToApply', label: 'How To Apply' },
  { key: 'rolesAndResponsibilities', label: 'Roles & Responsibilities' },
  { key: 'responsibilities', label: 'Responsibilities' },
  { key: 'coreSkills', label: 'Core Skills' },
]

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildLabelPattern = (label) => escapeRegex(label)
  .replace(/\\ /g, '\\s+')
  .replace(/\\\//g, '\\s*\\/\\s*')
  .replace(/\\&/g, '\\s*&\\s*')
  .replace(/\\-/g, '[-\\s]?')

const normalizeDashCharacters = (value) => String(value ?? '')
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/[â€“â€”]/g, '-')

const decodeHtml = (value) => normalizeDashCharacters(String(value ?? ''))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toLineArray = (html) => decodeHtml(
  String(html ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split(/\r?\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const resolveUrl = (value, baseUrl = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const stripTitlePrefix = (value) => normalizeWhitespace(value)?.replace(/^\d+\.\s*/, '') || null

const normalizeSectionValue = (value) => normalizeWhitespace(value)?.replace(/\s*\.$/, '') || null

const extractHrefForPath = (html, pathPattern) => {
  const pattern = new RegExp(`href=["']([^"']*${pathPattern}[^"']*)["']`, 'i')
  const match = String(html ?? '').match(pattern)
  return resolveUrl(match?.[1])
}

export const extractCareersUrl = (html) => extractHrefForPath(html, '\\/careers\\/?')

export const extractCurrentOpeningsUrl = (html) =>
  extractHrefForPath(html, '\\/careers\\/current-openings\\/?')

export const extractApplyEmail = (html) => {
  const page = decodeHtml(html)
  const exactMatch = page.match(/\bcareers@nimblework\.com\b/i)?.[0]
  if (exactMatch) return exactMatch.toLowerCase()

  const nearMatch = page.match(/\bcareer@nimblework\.com\b/i)?.[0]
  return nearMatch ? nearMatch.toLowerCase() : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return (
    normalized.includes('visual project management platform for your teams - nimblework')
    && normalized.includes('the delivery intelligence layer for human + agentic teams')
    && normalized.includes('ai-first where it counts. intelligent by design.')
    && normalized.includes('meet nimble - the ai-powered work management that adapts to you!')
    && normalized.includes('nimblework, inc')
    && extractCareersUrl(page) === CAREERS_URL
  )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return (
    normalized.includes('careers at nimblework')
    && normalized.includes('ai-driven lean-agile software delivery and project management products')
    && extractApplyEmail(page) === APPLY_EMAIL
    && extractCurrentOpeningsUrl(page) === CURRENT_OPENINGS_URL
  )
}

const extractAccordionItems = (html) => {
  const items = []
  const page = String(html ?? '')
  const pattern = /<div\b[^>]*id=["']([^"']+)["'][^>]*class=["'][^"']*elementor-tab-title[^"']*eael-accordion-header[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*class=["'][^"']*eael-accordion-tab-title[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>\s*<div\b[^>]*class=["'][^"']*eael-accordion-content clearfix[^"']*["'][^>]*aria-labelledby=["']\1["'][^>]*>([\s\S]*?)<\/div>/gi

  for (const match of page.matchAll(pattern)) {
    items.push({
      anchorId: normalizeWhitespace(match[1]),
      title: stripTitlePrefix(stripTags(match[2])),
      contentHtml: match[3],
    })
  }

  return items.filter((item) => item.anchorId && item.title && item.contentHtml)
}

export const hasOfficialCurrentOpeningsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return (
    normalized.includes('current openings at nimblework')
    && normalized.includes('careers at nimblework')
    && extractApplyEmail(page) === APPLY_EMAIL
    && extractAccordionItems(page).length > 0
  )
}

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return Number(page?.status) === 403
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && normalized.includes('enable javascript and cookies to continue')
}

const buildSectionMatchers = () => SECTION_DEFINITIONS.map((definition) => ({
  ...definition,
  pattern: new RegExp(`^${buildLabelPattern(definition.label)}\\s*:?\\s*(.*)$`, 'i'),
}))

const SECTION_MATCHERS = buildSectionMatchers()

const parseSections = (contentHtml) => {
  const sections = Object.fromEntries(SECTION_DEFINITIONS.map(({ key }) => [key, []]))
  const lines = toLineArray(contentHtml)
  let activeKey = null

  for (const line of lines) {
    const matchedSection = SECTION_MATCHERS.find(({ pattern }) => pattern.test(line))
    if (matchedSection) {
      const inlineValue = normalizeWhitespace(line.replace(matchedSection.pattern, '$1'))
      activeKey = matchedSection.key
      if (inlineValue) sections[activeKey].push(inlineValue)
      continue
    }

    if (activeKey) sections[activeKey].push(line)
  }

  return sections
}

const firstMatchingValue = (...values) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const first = value.find(Boolean)
      if (first) return first
      continue
    }

    if (value) return value
  }

  return null
}

const selectQualification = (sections) => {
  const educationQualification = normalizeSectionValue(sections.educationQualification.join(' '))
  if (educationQualification) return educationQualification

  return normalizeSectionValue(
    sections.requisites.find((line) => /\b(b\.?e|be\/b\.tech|m\.?e|mca|m\.?tech|mba)\b/i.test(line)),
  )
}

const selectExperience = (sections) => {
  const experience = normalizeSectionValue(firstMatchingValue(sections.experience))
  if (experience) {
    const exactExperience = experience.match(/at least \d+\s+years of experience/i)?.[0]
    if (exactExperience) return normalizeSectionValue(exactExperience)
    return normalizeSectionValue(experience.replace(/\s+of experience\b/i, ''))
  }

  const requisitesExperience = sections.requisites.find((line) => /\byears?\b/i.test(line))
  if (requisitesExperience) {
    return normalizeSectionValue(requisitesExperience.replace(/\s+of experience\b/i, ''))
  }

  const mustHaveExperience = sections.mustHave.find((line) => /\byears?\b/i.test(line))
  if (mustHaveExperience) {
    const exactExperience = mustHaveExperience.match(/at least \d+\s+years of experience/i)?.[0]
    return normalizeSectionValue(exactExperience || mustHaveExperience)
  }

  return null
}

const selectRequiredSkills = (sections) => {
  const groups = [
    sections.requiredSkills,
    sections.requirements,
    sections.technicalToolsSkillRequirement,
    sections.mustHave,
  ]

  for (const group of groups) {
    const skills = group.map((item) => normalizeSectionValue(item)).filter(Boolean)
    if (skills.length > 0) return skills
  }

  return []
}

const joinDescriptionParts = (...parts) => {
  const normalizedParts = parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return normalizedParts.length > 0 ? normalizedParts.join(' ') : null
}

const selectDescription = (sections) => {
  const primaryContent = sections.jobRequirements.length > 0
    ? sections.jobRequirements
    : sections.productManagerResponsibilities.length > 0
      ? sections.productManagerResponsibilities
      : sections.qualities

  const descriptionParts = [...primaryContent]
  if (sections.keySkills.length > 0) {
    descriptionParts.push(`Key Skills: ${sections.keySkills.join(' ')}`)
  }

  const descriptionBody = joinDescriptionParts(descriptionParts)
  return descriptionBody ? `Apply via ${APPLY_EMAIL}. ${descriptionBody}` : `Apply via ${APPLY_EMAIL}.`
}

const normalizeJobForProvider = (job, { now }) => {
  const normalized = normalizeScrapedJob({
    ...job,
    source: SOURCE,
    link: job.applyUrl,
    companyCareerPage: CURRENT_OPENINGS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    scrapedTimestamp: now(),
  }, {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: CURRENT_OPENINGS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    countryFilter: 'India',
  })

  if (/full stack developer/i.test(job.title)) {
    return {
      ...normalized,
      normalizedTitle: 'Software Engineer',
      engineeringDomain: 'Software Engineering',
    }
  }

  return normalized
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCurrentOpeningsSignal(html)) {
    throw new Error('Nimble Work, Inc verified first-party current openings page no longer matches the known accordion listings surface')
  }

  return extractAccordionItems(html).map(({ anchorId, title, contentHtml }) => {
    const sections = parseSections(contentHtml)
    const sourceUrl = `${CURRENT_OPENINGS_URL}#${anchorId}`

    return {
      title,
      company: COMPANY,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: `${SOURCE}-${slugify(title)}`,
      requisitionId: anchorId,
      sourceUrl,
      applyUrl: sourceUrl,
      department: null,
      employmentType: 'Full-time',
      experienceRequired: selectExperience(sections),
      minimumQualification: selectQualification(sections),
      preferredQualification: null,
      requiredSkills: selectRequiredSkills(sections),
      postingDate: null,
      closingDate: null,
      jobDescription: selectDescription(sections),
      remoteStatus: null,
    }
  })
}

export const createNimbleWorkScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage, fetchText, now: nowOverride } = {}) {
    const getNow = nowOverride || now
    const effectiveFetchPage = typeof fetchPage === 'function'
      ? fetchPage
      : typeof fetchText === 'function'
        ? createFetchPageFromText(fetchText)
        : defaultFetchPage

    const homepagePage = await effectiveFetchPage(HOMEPAGE_URL)
    let careersPage = null
    let currentOpeningsPage = null

    if (hasVerifiedCloudflareChallengeSignal(homepagePage)) {
      careersPage = await effectiveFetchPage(CAREERS_URL)
      currentOpeningsPage = await effectiveFetchPage(CURRENT_OPENINGS_URL)

      if (
        hasVerifiedCloudflareChallengeSignal(careersPage)
        && hasVerifiedCloudflareChallengeSignal(currentOpeningsPage)
      ) {
        return []
      }
    }

    if (!hasOfficialHomepageSignal(homepagePage.html)) {
      throw new Error('Nimble Work, Inc verified official homepage no longer matches the known first-party surface')
    }

    careersPage ||= await effectiveFetchPage(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Nimble Work, Inc verified first-party careers page no longer matches the known handoff surface')
    }

    currentOpeningsPage ||= await effectiveFetchPage(CURRENT_OPENINGS_URL)
    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsPage.html)) {
      throw new Error('Nimble Work, Inc verified first-party current openings page no longer matches the known accordion listings surface')
    }

    return extractPublicJobs(currentOpeningsPage.html).map((job) => normalizeJobForProvider(job, {
      now: getNow,
    }))
  },
})

export const run = async (options = {}) => createNimbleWorkScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Nimble Work, Inc jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
