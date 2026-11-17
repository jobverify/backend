import {runCurrentPletra} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'




const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pletratechnologiesindiapvtltd'
export const COMPANY = 'Pletra Technologies India Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://pletratech.com/'
export const CONTACT_URL = 'https://pletratech.com/contact-us/'
export const CAREERS_URL = 'https://pletratech.com/careers-pletra-technologies/'
export const CAREERS_ALIAS_URLS = ['https://pletratech.com/careers-page/']
export const COMPANY_DOMAIN = 'pletratech.com'

const ACCORDION_ITEM_PATTERN = /<div\b[^>]*class=["'][^"']*elementor-accordion-item[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*class=["'][^"']*elementor-accordion-title[^"']*["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<div\b[^>]*class=["'][^"']*elementor-tab-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6]|\/a|\/ul|\/ol)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|main|h[1-6]|a|ul|ol)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    url.search = ''
    return url.toString()
  } catch {
    return null
  }
}

const extractAccordionBlocks = (html) => [
  ...String(html ?? '').matchAll(ACCORDION_ITEM_PATTERN),
].map((match) => ({
  title: normalizeWhitespace(match[1]),
  detailsHtml: String(match[2] ?? ''),
}))

const hasAccordionOpenings = (html) => extractAccordionBlocks(html).length >= 2

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/pletratech\.com\/careers-pletra-technologies\/|https:\/\/pletratech\.com\/careers-page\/|\/careers-pletra-technologies\/|\/careers-page\/)["']/i.test(
    String(html ?? ''),
  )

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ').toLowerCase()

  return /<title>\s*Certified Salesforce Implementation Partner\s*\|\s*Pletratech\s*<\/title>/i.test(page)
    && text.includes('trusted salesforce implementation partner')
    && text.includes('contact us')
    && /info@pletratech\.com/i.test(page)
    && hasVerifiedCareersLink(page)
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ').toLowerCase()

  return /<title>\s*Contact Us\s*-\s*Salesforce Implementation,\s*Consulting\s*&(?:amp;|#038;)\s*Software Solutions\s*<\/title>/i.test(page)
    && (text.includes('pletra technologies india offices') || text.includes('pletratech india offices:'))
    && text.includes('pune address - office # 102, pentagon 1, magarpatta city, hadapsar, pune-411013')
    && /info@pletratech\.com/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ').toLowerCase()

  return /<title>\s*Careers\s*-\s*Salesforce Implementation,\s*Consulting\s*&(?:amp;|#038;)\s*Software Solutions\s*<\/title>/i.test(page)
    && text.includes('careers')
    && /info@pletratech\.com/i.test(page)
    && hasAccordionOpenings(page)
}

export const isVerifiedCareersAlias = ({ status, url, html }) =>
  status === 200
  && normalizeUrl(url) === CAREERS_URL
  && hasOfficialCareersSignal(html)

const extractTitleAndLocation = (rawTitle) => {
  const title = normalizeWhitespace(rawTitle)
  if (!title) return { title: null, rawLocation: null }

  const locationMatch = title.match(/^(.*?)\s*-\s*Location\s*-\s*(.+)$/i)
  if (locationMatch) {
    return {
      title: normalizeWhitespace(locationMatch[1]),
      rawLocation: normalizeWhitespace(locationMatch[2]),
    }
  }

  const suffixLocationMatch = title.match(/^(.*?)\s*-\s*(Belgium)$/i)
  if (suffixLocationMatch) {
    return {
      title: normalizeWhitespace(suffixLocationMatch[1]),
      rawLocation: normalizeWhitespace(suffixLocationMatch[2]),
    }
  }

  return { title, rawLocation: null }
}

const extractExperienceRequired = (lines) => {
  for (const line of lines) {
    const match = line.match(/(\d+\+?\s*(?:to\s*\d+\s*)?(?:years?|yrs?))/i)
    if (match) {
      return normalizeWhitespace(match[1])
    }
  }

  return null
}

const normalizeJobLocation = (rawLocation) => {
  const normalized = normalizeWhitespace(rawLocation)
  if (!normalized) return { location: null, city: null, country: null }
  if (/^belgium$/i.test(normalized)) return { location: 'Belgium', city: null, country: 'Belgium' }
  if (/^india$/i.test(normalized)) return { location: 'India', city: null, country: 'India' }
  return { location: normalized, city: null, country: null }
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Pletra verified careers surface no longer matches the known first-party page')
  }

  const jobs = extractAccordionBlocks(html)
    .map(({ title: rawTitle, detailsHtml }) => {
      const { title, rawLocation } = extractTitleAndLocation(rawTitle)
      if (!title) throw new Error('Pletra incomplete public opening: missing title')

      const lines = stripTagsToLines(detailsHtml)
      if (lines.length === 0) throw new Error('Pletra incomplete public opening: missing description')

      const { location, city, country } = normalizeJobLocation(rawLocation)

      return {
        title,
        company: COMPANY,
        location,
        city,
        country,
        jobId: null,
        requisitionId: null,
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        employmentType: null,
        experienceRequired: extractExperienceRequired(lines),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: lines.join('\n'),
        remoteStatus: null,
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Pletra careers page no longer exposes verified public openings')
  }

  const advertised = (String(html).match(/class=["'][^"']*\belementor-accordion-item\b[^"']*["']/gi) || []).length
  if (advertised !== jobs.length || new Set(jobs.map(job => JSON.stringify([job.title, job.location, job.jobDescription]))).size !== jobs.length) throw new Error('Pletra incomplete or duplicate public opening inventory')
  return jobs
}

export const createPletraTechnologiesIndiaScraper = () => ({run:runCurrentPletra})

export const run = async (options = {}) => createPletraTechnologiesIndiaScraper().run(options)

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
