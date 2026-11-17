import {runCurrentIndiIt} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import INDI_IT_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INDI_IT_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const SHARED_APPLY_URL = new URL('#Career', OFFICIAL_CAREERS_URL).toString()
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialIndiItCareerSignals = (html = '') => {
  const page = String(html ?? '')

  return /Join Our Vibrant Team at Indi IT\./i.test(page)
    && /View Open Roles/i.test(page)
    && /Top Opportunities Right Now\./i.test(page)
    && /hr@indiit\.com/i.test(page)
}

export const extractOpportunityCards = (html = '') => {
  const roles = []

  for (const match of String(html ?? '').matchAll(/<article\b[^>]*class=["'][^"']*\bindi-role-card\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const articleHtml = match[1]
    const title = normalizeWhitespace(articleHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const experienceRequired = normalizeWhitespace(articleHtml.match(/class=["'][^"']*\bexperience\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const vacancies = normalizeWhitespace(articleHtml.match(/class=["'][^"']*\bvacancies\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const applyUrl = normalizeWhitespace(articleHtml.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1])

    if (!title || !experienceRequired || !vacancies || !applyUrl) continue

    roles.push({
      title,
      location: null,
      city: null,
      country: null,
      experienceRequired,
      vacancies,
      applyUrl,
      sourceUrl: applyUrl,
      // The live page can reuse the same shared CTA across multiple roles, so derive
      // the identifier from the visible card content instead of the link hash alone.
      jobId: slugify(`${title}-${experienceRequired}-${vacancies}`),
    })
  }

  if (roles.length > 0) {
    return roles
  }

  const normalized = normalizeWhitespace(html)
  const opportunitiesSection = normalized.includes('Top Opportunities Right Now.')
    ? normalized.slice(normalized.indexOf('Top Opportunities Right Now.'))
    : normalized
  const listingsText = opportunitiesSection.includes('Action ')
    ? opportunitiesSection.slice(opportunitiesSection.indexOf('Action ') + 'Action '.length)
    : opportunitiesSection

  for (const match of listingsText.matchAll(
    /([A-Za-z][A-Za-z0-9/&,+\-(). ]*?)\s+(Minimum\s+\d+\+?\s+years?\s+of experience)\s+(\d+\s+Vacancies?)\s+Apply Now/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const experienceRequired = normalizeWhitespace(match[2])
    const vacancies = normalizeWhitespace(match[3])

    if (!title || !experienceRequired || !vacancies) continue

    roles.push({
      title,
      location: null,
      city: null,
      country: null,
      experienceRequired,
      vacancies,
      applyUrl: SHARED_APPLY_URL,
      sourceUrl: SHARED_APPLY_URL,
      jobId: slugify(`${title}-${experienceRequired}-${vacancies}`),
    })
  }

  return roles
}

export const createIndiItSolutionsScraper = () => ({run:runCurrentIndiIt})

export const run = async (options = {}) => createIndiItSolutionsScraper(options).run(options)

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
