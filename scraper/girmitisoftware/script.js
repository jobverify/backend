import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'girmitisoftware'
export const COMPANY = 'Girmiti Software'
export const COMPANY_DOMAIN = 'girmiti.com'
export const CURRENT_OPENINGS_URL = 'https://www.girmiti.com/current_openings.html'
export const CAREERS_EMAIL = 'careers@girmiti.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const classifyCountry = (location) => (/bangalore|bengaluru|india/i.test(location) ? 'India' : 'United States')

const normalizeLocation = (location) => {
  const cleaned = stripTags(location)
  const country = classifyCountry(cleaned)

  return {
    location: country === 'India' ? `${cleaned}, India` : cleaned,
    city: cleaned.split(',')[0]?.trim() || null,
    country,
  }
}

export const hasOfficialCurrentOpeningsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Girmiti Software \| Current Openings\s*<\/title>/i.test(page)
    && /careers@girmiti\.com/i.test(page)
    && /Job Code:\s*GJ-00A001/i.test(page)
}

export const extractOpenings = (html) => [...String(html ?? '').matchAll(
  /<div class=["'][^"']+["'][\s\S]*?<h5>([\s\S]*?)<\/h5>[\s\S]*?<h6>\s*Job Code:\s*([^<]+)<\/h6>[\s\S]*?<p>\s*Job Location\s*:\s*([\s\S]*?)<\/p>[\s\S]*?<p>\s*Job Description:\s*<\/p>[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi,
)].map((match) => {
  const title = stripTags(match[1])
  const jobCode = stripTags(match[2])
  const locationData = normalizeLocation(match[3])
  const jobDescription = stripTags(match[4]) || null
  const subject = encodeURIComponent(`${jobCode} ${title}`)

  return {
    title,
    company: COMPANY,
    department: null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    jobId: jobCode,
    requisitionId: jobCode,
    sourceUrl: `${CURRENT_OPENINGS_URL}#${jobCode}`,
    applyUrl: `mailto:${CAREERS_EMAIL}?subject=${subject}`,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
  }
})

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const createGirmitiSoftwareScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)

    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('Girmiti Software current openings page no longer matches the verified first-party surface')
    }

    return extractOpenings(currentOpeningsHtml).map((job) => ({
      ...job,
      source: SOURCE,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-first-party-current-openings-page',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createGirmitiSoftwareScraper().run(options)

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
