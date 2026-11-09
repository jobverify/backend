import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://www.e-consystems.com/'
export const CAREER_PAGE_URL = 'https://www.e-consystems.com/careers.asp'

const COMPANY = 'e-con Systems'
const SOURCE = 'econsystem'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/Â®/g, '®')
  .replace(/Â/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(value)

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/Â®/g, '®')
  .replace(/Â/g, ' ')

const slugify = (value) => normalizeWhitespace(decodeHtml(value))
  .normalize('NFKD')
  .replace(/[^\w\s-]/g, '')
  .toLowerCase()
  .replace(/[\s_-]+/g, '-')
  .replace(/^-+|-+$/g, '')

const getSection = (html, jobId) => {
  const page = String(html ?? '')
  const wrappedSections = [...page.matchAll(/<section[^>]*class=["'][^"']*career-opening[^"']*["'][^>]*>[\s\S]*?<\/section>/gi)]

  for (const match of wrappedSections) {
    if (new RegExp(`<h2[^>]*>\\s*JOB ID:\\s*${jobId}\\s*<\\/h2>`, 'i').test(match[0])) {
      return match[0]
    }
  }

  const headingPattern = /<h2[^>]*>\s*JOB ID:\s*([^<\s]+)\s*<\/h2>/gi
  const headings = [...page.matchAll(headingPattern)]
  const currentIndex = headings.findIndex((match) => normalizeWhitespace(match[1]) === jobId)

  if (currentIndex === -1) return null

  const startIndex = headings[currentIndex].index
  const endIndex = headings[currentIndex + 1]?.index ?? page.length

  return page.slice(startIndex, endIndex)
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractMailtoSubject = (sectionHtml, jobId) => {
  for (const match of String(sectionHtml ?? '').matchAll(/href=["'](mailto:[^"']+)["']/gi)) {
    try {
      const subject = new URL(decodeHtml(match[1])).searchParams.get('subject')?.trim()
      if (subject?.toLowerCase().startsWith(jobId.toLowerCase() + ':')) return subject
    } catch {}
  }
  return null
}

const getParagraphValue = (sectionHtml, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(sectionHtml ?? '').match(
    new RegExp(`<p[^>]*>\\s*${escapedLabel}\\s*:?\\s*([\\s\\S]*?)<\\/p>`, 'i'),
  )
  if (match) return stripHtml(match[1])
  const cell = String(sectionHtml ?? '').match(new RegExp(
    '<td\\b[^>]*>\\s*<(?:b|strong)>\\s*' + escapedLabel + '\\s*:?[ \\t]*<\\/(?:b|strong)>\\s*([\\s\\S]*?)<\\/td>', 'i',
  ))
  return stripHtml(cell?.[1])
}

const getDescription = (sectionHtml) => {
  const match = String(sectionHtml ?? '').match(
    /<h3[^>]*>\s*Role Overview:\s*<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
  )
  return stripHtml(match?.[1])
}

const getSkillsFromHeading = (sectionHtml, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(sectionHtml ?? '').match(
    new RegExp(`<h4[^>]*>\\s*${escapedHeading}\\s*<\\/h4>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`, 'i'),
  )

  return [...String(match?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => stripHtml(item[1]))
    .filter(Boolean)
}

const getFallbackSkills = (sectionHtml) => {
  const match = String(sectionHtml ?? '').match(
    /<h3[^>]*>\s*Skillsets:\s*<\/h3>\s*([\s\S]*?)(?=<a\b|<\/section>)/i,
  )

  return [...String(match?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => stripHtml(item[1]))
    .filter(Boolean)
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (!normalized) return 'Full-time'
  if (/intern/.test(normalized)) return 'Internship'
  return 'Full-time'
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*e-con Systems(?:&reg;|®)?: Develops & Manufactures OEM Cameras(?:\s*\|\s*20\+\s*Years of Expertise)?\s*<\/title>/i.test(page)
    && /Since 2003, e-con Systems/i.test(page)
    && /\/careers\.asp/i.test(page)
    && /Employee Login/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Join Our Team: Innovation & Engineering Careers at e-con Systems\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*Careers\s*<\/h1>/i.test(page)
    && /Positions and Eligibility/i.test(page)
    && /JOB ID:\s*e-con001/i.test(page)
}

export const extractOpenings = (html) => {
  const page = String(html ?? '')
  const jobIds = [...page.matchAll(/<h2[^>]*>\s*JOB ID:\s*([^<\s]+)\s*<\/h2>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  return jobIds.map((jobId) => {
    const sectionHtml = getSection(page, jobId)
    if (!sectionHtml) {
      return null
    }

    const title = getParagraphValue(sectionHtml, 'Position')
      || normalizeWhitespace(
        extractMailtoSubject(sectionHtml, jobId)?.replace(new RegExp(`^${escapeRegex(jobId)}:\\s*`, 'i'), ''),
      )
    const department = getParagraphValue(sectionHtml, 'Geography')
    const city = getParagraphValue(sectionHtml, 'Location')
    const experienceRequired = getParagraphValue(sectionHtml, 'Experience')
    const qualification = getParagraphValue(sectionHtml, 'Educational Qualification')
    if (!title) throw new Error('e-con Systems job title is missing for ' + jobId)
    const hasTabularSynopsis = /<td\b[^>]*>\s*<(?:b|strong)>\s*Position\s*:/i.test(sectionHtml)
    const applyAnchor = /<a\b[^>]*>\s*Apply Here\s*<\/a>/i.exec(sectionHtml)
    const description = hasTabularSynopsis
      ? stripHtml(sectionHtml.slice(0, applyAnchor?.index ?? sectionHtml.length))
      : getDescription(sectionHtml)
    const applyHref = String(sectionHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Here\s*<\/a>/i)?.[1] ?? '')
    const applyUrl = applyHref ? new URL(decodeHtml(applyHref), CAREER_PAGE_URL).toString() : CAREER_PAGE_URL
    const requiredSkills = [
      ...getSkillsFromHeading(sectionHtml, 'What you will do:'),
      ...getSkillsFromHeading(sectionHtml, 'What We Expect:'),
      ...getSkillsFromHeading(sectionHtml, 'Skillsets:'),
    ]
    const normalizedSkills = requiredSkills.length ? requiredSkills : getFallbackSkills(sectionHtml)

    return {
      title,
      company: COMPANY,
      department,
      location: city ? `${city}, India` : 'India',
      city: city || null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: new RegExp('<a[^>]+(?:name|id)=["\']' + escapeRegex(jobId) + '["\']', 'i').test(page)
        ? CAREER_PAGE_URL + '#' + jobId : CAREER_PAGE_URL,
      applyUrl,
      employmentType: normalizeEmploymentType(title),
      experienceRequired,
      minimumQualification: qualification,
      preferredQualification: null,
      requiredSkills: normalizedSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: description,
      ...(hasTabularSynopsis ? { publicExperienceChecked: true } : {}),
    }
  }).filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEconSystemScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('e-con Systems homepage no longer matches the verified official public site')
    }

    const careersHtml = await fetchText(CAREER_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('e-con Systems careers page no longer matches the verified official public jobs surface')
    }

    const jobs = extractOpenings(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createEconSystemScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running e-con Systems scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
