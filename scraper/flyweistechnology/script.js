import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FLYWEIS_TECHNOLOGY_CATALOG } from './catalog.js'
import { createCurrentFlyweisScraper } from './currentNative20261115.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = FLYWEIS_TECHNOLOGY_CATALOG.homepageUrl
export const SOURCE = FLYWEIS_TECHNOLOGY_CATALOG.source

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Flyweis Technology')
    && normalized.includes('We are an end-to-end IT services agency providing turnkey solutions for your business')
    && normalized.includes('Project Completed')
    && normalized.includes('Team Members')
}

export const hasCareersSignal = (html = '') =>
  /href=["'][^"']*\/(?:careers?|jobs?|join-us|work-with-us)[/"'#?]?/i.test(String(html ?? ''))
  || /\bcurrent openings\b|\bjob openings\b|\bopen positions\b/i.test(String(html ?? ''))

export const createFlyweisTechnologyScraper = () => createCurrentFlyweisScraper()

export const run = async (options = {}) => createFlyweisTechnologyScraper().run(options)

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
