import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFinzlyNativeInventory } from './nativeInventory.js'
import { CAREERS_URL } from './nativeInventory.js'
import { FINZLY_CATALOG } from './catalog.js'
export { CAREERS_URL, HOMEPAGE_URL } from './nativeInventory.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = FINZLY_CATALOG
export const BOARD_URL = CAREERS_URL
export const LEGACY_WORKABLE_BOARD_URL = 'https://apply.workable.com/finzly/'
export const LEGACY_WORKABLE_FEED_URL = 'https://apply.workable.com/finzly/jobs.md'

const COMPANY_NAME = 'Finzly'
const SOURCE = 'finzly'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\r/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeLocationPart = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const titleCase = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase())

const parseLocation = (value) => {
  const parts = String(value ?? '')
    .split(',')
    .map((part) => normalizeLocationPart(part))
    .filter(Boolean)

  const country = parts.at(-1) || null
  const city = parts[0] || null
  const state = parts.length >= 3 ? parts[1] : null

  return {
    location: parts.join(', ') || null,
    city,
    state,
    country,
  }
}

const isIndiaLocation = (value) => /(^|[\s,(])india($|[\s,).])/i.test(String(value ?? ''))

const extractJobId = (url) => {
  try {
    const pathnameParts = new URL(url).pathname.split('/').filter(Boolean)
    const jobToken = pathnameParts.at(-1) || null
    return jobToken ? jobToken.toUpperCase() : null
  } catch {
    return null
  }
}

export const extractJobsFromMarkdown = (markdown) => {
  const normalized = String(markdown ?? '')
  if (!normalized.trim() || /\b0 current openings\b/i.test(normalized)) return []

  return normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const match = /^-\s+\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*-\s*(.+)$/i.exec(line)
      if (!match) return null

      const [, rawTitle, rawUrl, rawLocation] = match
      const locationBits = parseLocation(rawLocation)
      const jobId = extractJobId(rawUrl)

      if (!rawTitle || !rawUrl || !jobId || !isIndiaLocation(locationBits.location)) return null

      return {
        title: normalizeWhitespace(rawTitle),
        company: COMPANY_NAME,
        ...locationBits,
        jobId,
        requisitionId: jobId,
        sourceUrl: rawUrl,
        applyUrl: rawUrl,
        department: null,
        employmentType: null,
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
    .map((job) => ({
      ...job,
      city: job.city ? titleCase(job.city) : null,
      state: job.state ? titleCase(job.state) : null,
      country: job.country ? titleCase(job.country) : null,
      location: job.location
        ? job.location
          .split(',')
          .map((part) => titleCase(part.trim()))
          .join(', ')
        : null,
    }))
}

export const createFinzlyScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : 0,
  now = () => new Date().toISOString(),
} = {}) => createFinzlyNativeInventory({ maxJobs: maxJobs ?? 0, now })

export const run = async (options = {}) => createFinzlyScraper().run(options)
