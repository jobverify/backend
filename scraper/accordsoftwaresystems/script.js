import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ACCORD_SOFTWARE_AND_SYSTEMS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLY_FORM_URL = PROVIDER_METADATA.applyFormUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripScriptsAndStyles = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const stripTags = (value) => normalizeWhitespace(
  stripScriptsAndStyles(value).replace(/<[^>]+>/g, ' '),
)

const htmlToLines = (value) => decodeHtmlEntities(
  stripScriptsAndStyles(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|form)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const normalizeAccordLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (/^banagalore$/i.test(normalized || '')) return 'Bangalore'
  return normalized
}

const formatLocation = (location) => {
  const normalized = normalizeAccordLocation(location)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractTextField = (lines, startIndex, label) => {
  const labelIndex = lines.indexOf(label, startIndex)
  if (labelIndex < 0) return null
  return normalizeWhitespace(lines[labelIndex + 1])
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(html) || ''

  const isLegacyCareersSurface = normalized.includes('Careers at Accord')
    && normalized.includes('Creating cutting-edge technology is a way of life at Accord.')
    && normalized.includes('Lead Production Engineer')
    && normalized.includes('Apply Now')

  const isCurrentCareersSurface = /<title>\s*Explore Career Opportunities \| Accord Software &(?:amp;)? Systems Pvt Ltd\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Discover rewarding careers at Accord Soft\. Join a dynamic team of experts and grow your skills in cutting-edge technology solutions\.["']/i.test(page)
    && normalized.includes('Embedded Software Engineer')
    && normalized.includes('Systems Engineer FPGA')
    && /href=["']career-form\.php["'][^>]*>\s*Apply Now\s*</i.test(page)

  return isLegacyCareersSurface || isCurrentCareersSurface
}

export const hasOfficialApplyFormSignal = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Join Us')
    && normalized.includes('Submit Your Resume')
    && normalized.includes('Accord Software & Systems Pvt Ltd')
    && normalized.includes('resumes@accord-soft.com')
}

export const extractJobCards = (html = '') => {
  const lines = htmlToLines(html)
  const cards = []

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== 'Education Qualification') continue

    const title = normalizeWhitespace(lines[index - 2])
    const employmentLine = normalizeWhitespace(lines[index - 1])
    const educationQualification = normalizeWhitespace(lines[index + 1])
    const experienceRequired = extractTextField(lines, index, 'Years of experience')
    const location = extractTextField(lines, index, 'Work Location')
    const openings = extractTextField(lines, index, 'No. of Position')
    const keySkillsIndex = lines.indexOf('Key skills/JD', index)

    if (!title || keySkillsIndex < 0) continue

    const keySkills = []
    for (let skillIndex = keySkillsIndex + 1; skillIndex < lines.length; skillIndex += 1) {
      const line = lines[skillIndex]
      if (
        line === 'Apply Now'
        || line === 'Education Qualification'
        || line === 'Disclaimer'
      ) {
        break
      }
      if (!line) continue
      keySkills.push(line)
    }

    const employmentType = normalizeWhitespace(employmentLine?.split('-')[0])

    cards.push({
      title,
      employmentType,
      educationQualification,
      experienceRequired,
      location,
      openings,
      applyUrl: APPLY_FORM_URL,
      keySkills,
    })
  }

  return cards
}

const buildJobId = (title, location) => `${slugify(title)}-${slugify(location)}`

export const createAccordSoftwareAndSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Accord careers page no longer matches the trusted first-party surface')
    }

    const applyFormHtml = await fetchText(APPLY_FORM_URL)
    if (!hasOfficialApplyFormSignal(applyFormHtml)) {
      throw new Error('The verified Accord apply form no longer matches the trusted first-party surface')
    }

    return extractJobCards(careersHtml).map((card) => {
      const normalizedLocation = normalizeAccordLocation(card.location)
      const jobId = buildJobId(card.title, normalizedLocation)

      return {
        title: card.title,
        company: COMPANY,
        department: null,
        location: formatLocation(card.location),
        city: normalizedLocation,
        country: 'India',
        sourceUrl: CAREERS_URL,
        applyUrl: card.applyUrl,
        jobId,
        requisitionId: jobId,
        employmentType: card.employmentType,
        experienceRequired: card.experienceRequired,
        minimumQualification: card.educationQualification,
        preferredQualification: null,
        requiredSkills: card.keySkills,
        postingDate: null,
        closingDate: null,
        jobDescription: normalizeWhitespace(card.keySkills.join(' ')),
        remoteStatus: 'On-site',
        source: SOURCE,
        link: CAREERS_URL,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      }
    })
  },
})

export const run = async (options = {}) => createAccordSoftwareAndSystemsScraper(options).run(options)

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
