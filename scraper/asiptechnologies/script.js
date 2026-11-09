import path from 'path'
import { fileURLToPath } from 'url'
import { createCurrentAsipScraper, readCurrentAsipListings } from './currentNative.js'

const BASE_URL = 'https://asip-tech.com'
export const CAREERS_PAGE_URL = `${BASE_URL}/careers/`
const currentDir = path.dirname(fileURLToPath(import.meta.url))

const normalizeWhitespace = (value) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8211;|&#x2013;/gi, '-')
  .replace(/&#8212;|&#x2014;/gi, '-')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\s+/g, ' ')
  .replace(/^["'>]+/, '')
  .trim()

const toAbsoluteUrl = (value) => new URL(value, BASE_URL).toString()

const slugFromUrl = (url) => {
  const parts = new URL(url).pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] || null
}

const extractField = (html, label) => {
  const match = String(html || '').match(new RegExp(`${label}\\s*:?\\s*(?:<[^>]*>\\s*){0,3}([^<]+)`, 'i'))
  return match ? normalizeWhitespace(match[1]) : null
}

export const extractListings = (html) => {
  const current = readCurrentAsipListings(html, { allowMissing: true })
  if (current) return current
  const source = String(html || '')
  const listingBlocks = [...source.matchAll(/<div[^>]+class=["'][^"']*job-listing[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)]
    .map((match) => match[1])

  return listingBlocks
    .map((block) => {
      const linkMatch = block.match(/<a[^>]+href=["']([^"']*\/career\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
      if (!linkMatch) return null

      const sourceUrl = toAbsoluteUrl(linkMatch[1])
      const title = normalizeWhitespace(linkMatch[2])
      const department = extractField(block, 'job-category')
      const employmentType = extractField(block, 'job-type')
      const city = extractField(block, 'job-location')
      const jobId = slugFromUrl(sourceUrl)

      if (!title || !jobId || !city) return null

      return {
        title,
        company: 'ASIP Technologies',
        department,
        location: city,
        city,
        country: null,
        jobId,
        requisitionId: null,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
}

export const createAsipTechnologiesScraper = (defaults = {}) => createCurrentAsipScraper(defaults)

export const run = async (options = {}) => createAsipTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  console.log(`Total ASIP Technologies jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'asiptechnologies')
}
