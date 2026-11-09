import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'valuefirstdigitalmedia'
export const COMPANY = 'ValueFirst Digital Media'
export const HOMEPAGE_URL = 'https://www.vfirst.com/'
export const CAREERS_URL = 'https://www.vfirst.com/resources/careers'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'ValueFirst',
  adapter: 'script',
  modulePath: '../../scraper/valuefirstdigitalmedia/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-first-party-role-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-page-role-list-plus-first-party-role-pages',
  extractionStrategy: 'verified-first-party-careers-page+same-page-role-list+first-party-role-detail-page',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'vfirst.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.vfirst.com/resources/careers was the live first-party ValueFirst careers page and that it publicly listed the India role Sales Manager - Acquisition in Gurugram with a first-party detail page at https://www.vfirst.com/job-opening/sales-manager-acquisition.',
  dryRunFile: 'valuefirstdigitalmedia/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Join Our Team \| Careers at ValueFirst\s*<\/title>/i.test(page)
    && /#JoinTheJoy/i.test(page)
    && /Open Roles/i.test(page)
    && /Sales Manager - Acquisition/i.test(page)
}

export const extractRoleSummaries = (html = '') => {
  const page = String(html ?? '')
  const matches = [
    ...page.matchAll(
      /Open Roles[\s\S]*?<div[^>]*class=["'][^"']*s-paragraph[^"']*["'][^>]*>\s*([^<]+,\s*India)\s*<\/div>[\s\S]*?<div[^>]*class=["'][^"']*s-paragraph[^"']*["'][^>]*>\s*(Full-Time)\s*<\/div>[\s\S]*?<h5[^>]*>\s*([^<]+?)\s*<\/h5>[\s\S]*?<a[^>]*href=["']([^"']*\/job-opening\/[^"']+)["'][^>]*>[\s\S]*?Learn More[\s\S]*?<\/a>/gi,
    ),
  ]

  return matches.map((match) => ({
    location: normalizeWhitespace(match[1]),
    employmentType: normalizeWhitespace(match[2]),
    title: normalizeWhitespace(match[3]),
    sourceUrl: new URL(match[4], CAREERS_URL).toString(),
  }))
}

export const hasRoleDetailSignal = (html = '', title) => {
  const page = String(html ?? '')
  return page.includes(title)
    && /Apply for this position!/i.test(page)
    && /Gurugram,\s*India/i.test(page)
    && /Full-Time/i.test(page)
}

const extractRoleDescription = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(
      /This is a highly motivated and aggressive team responsible for developing new business opportunities\./i,
    )?.[0]
    || String(html ?? '').match(/This is a highly motivated[\s\S]*?Minimum qualifications:/i)?.[0],
  ) || null

export const run = async ({
  fetchText = async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
    return response.text()
  },
  now = () => new Date().toISOString(),
} = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('ValueFirst Digital Media verified first-party careers page changed materially')
  }

  const roles = extractRoleSummaries(careersHtml)
  if (!roles.length) {
    throw new Error('ValueFirst Digital Media careers page no longer exposes trusted public role summaries')
  }

  const jobs = []
  for (const role of roles) {
    const detailHtml = await fetchText(role.sourceUrl)
    if (!hasRoleDetailSignal(detailHtml, role.title)) {
      throw new Error(`ValueFirst Digital Media role detail changed materially for ${role.title}`)
    }

    jobs.push({
      title: role.title,
      company: COMPANY,
      location: role.location,
      country: 'India',
      employmentType: role.employmentType,
      sourceUrl: role.sourceUrl,
      applyUrl: role.sourceUrl,
      description: extractRoleDescription(detailHtml),
      link: role.sourceUrl,
      source: SOURCE,
      scrapedAt: now(),
    })
  }

  return jobs
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}

