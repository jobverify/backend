import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://ausweginfocontrols.com/careers/'
export const APPLY_URL = 'https://forms.office.com/r/PsAiab6FFZ?origin=lprLink'

const COMPANY = 'Ausweg Info Controls Pvt Ltd'
const SOURCE = 'ausweginfocontrols'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const cleanLine = (value) => normalizeWhitespace(value)
  .replace(/^[•*-]\s*/, '')
  .trim()

const slugify = (value) => cleanLine(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toTextLines = (html) => decodeHtml(String(html ?? ''))
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span|\/a)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span|a)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => cleanLine(line))
  .filter(Boolean)

const SECTION_HEADERS = new Set([
  'Job Description',
  'Company Description',
  'Company Descriptions',
  'About the Role',
  'Role Summary',
  'Key Responsibilities',
  'Skills & Requirements',
  'Technical Competencies',
  'Soft Skills',
  'Apply Now',
])

const isLocationLine = (value) => /,/.test(value || '')

const parseLabelValue = (blockLines, label) => {
  const line = blockLines.find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`))
  if (!line) return null
  return cleanLine(line.slice(label.length + 1))
}

const collectSectionLines = (blockLines, heading) => {
  const startIndex = blockLines.findIndex((line) => line === heading)
  if (startIndex < 0) return []

  const lines = []
  for (let index = startIndex + 1; index < blockLines.length; index += 1) {
    const line = blockLines[index]
    if (SECTION_HEADERS.has(line) || /^Job Type:|^Experience:|^Qualification:/i.test(line)) {
      break
    }
    lines.push(line)
  }

  return lines
}

const buildDescription = (summaryLines, requiredSkills) => cleanLine(
  [...summaryLines, ...requiredSkills].join(' '),
) || null

const normalizeLocation = (value) => {
  const cleaned = cleanLine(value)
    .replace(/\bKaranataka\b/gi, 'Karanataka')
    .replace(/\bTamilnadu\b/gi, 'Tamilnadu')

  return cleaned ? `${cleaned}, India` : null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Careers\s*\|\s*Ausweg Info Controls/i.test(page)
    && /Career Opportunities/i.test(page)
    && /Apply Now/i.test(page)
    && /Ausweg Info Controls Pvt Ltd/i.test(page)
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified Ausweg careers surface with public opportunities')
  }

  const lines = toTextLines(html)
  const startIndex = lines.findIndex((line) => line === 'Career Opportunities')
  if (startIndex < 0) {
    throw new Error('Expected verified Ausweg careers surface with public opportunities')
  }

  const jobs = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const title = lines[index]
    const locationLine = lines[index + 1]

    if (!title || !locationLine || SECTION_HEADERS.has(title) || !isLocationLine(locationLine)) {
      continue
    }

    const preview = lines.slice(index + 2, index + 8)
    if (!preview.includes('Job Description')) {
      continue
    }

    const blockLines = []
    let cursor = index + 2

    while (cursor < lines.length) {
      const line = lines[cursor]
      if (line === 'Apply Now') {
        break
      }
      blockLines.push(line)
      cursor += 1
    }

    if (cursor >= lines.length || lines[cursor] !== 'Apply Now') {
      continue
    }

    const summaryLines = collectSectionLines(blockLines, 'About the Role')
    const roleSummaryLines = collectSectionLines(blockLines, 'Role Summary')
    const keyResponsibilities = collectSectionLines(blockLines, 'Key Responsibilities')
    const skillRequirements = collectSectionLines(blockLines, 'Skills & Requirements')
    const technicalCompetencies = collectSectionLines(blockLines, 'Technical Competencies')
    const softSkills = collectSectionLines(blockLines, 'Soft Skills')
    const requiredSkills = [
      ...keyResponsibilities,
      ...skillRequirements,
      ...technicalCompetencies,
      ...softSkills,
    ]
    const minimumQualification = parseLabelValue(blockLines, 'Qualification')
    const experienceRequired = parseLabelValue(blockLines, 'Experience')
    const employmentType = parseLabelValue(blockLines, 'Job Type')
    const city = normalizeCity(locationLine.split(',')[0]?.trim() || null)
    const slug = slugify(title)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: normalizeLocation(locationLine),
      city,
      country: 'India',
      jobId: `${SOURCE}-${slug}`,
      requisitionId: `${SOURCE}-${slug}`,
      sourceUrl: `${CAREERS_URL}#${slug}`,
      applyUrl: APPLY_URL,
      employmentType,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: buildDescription(
        summaryLines.length > 0 ? summaryLines : roleSummaryLines,
        requiredSkills,
      ),
      remoteStatus: 'On-site',
    })

    index = cursor
  }

  if (jobs.length === 0) {
    throw new Error('Expected verified Ausweg careers surface with public opportunities')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createAuswegInfoControlsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    return extractPublicListings(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createAuswegInfoControlsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Ausweg Info Controls jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
