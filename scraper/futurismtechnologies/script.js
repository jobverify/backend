import path from 'node:path'
import { fileURLToPath } from 'node:url'

import FUTURISM_TECHNOLOGIES_CATALOG from './catalog.js'
import {collectCurrentFuturism as run} from './currentNative20261121.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FUTURISM_TECHNOLOGIES_CATALOG.source
export const COMPANY = FUTURISM_TECHNOLOGIES_CATALOG.companyName
export const PROVIDER_METADATA = FUTURISM_TECHNOLOGIES_CATALOG
export const VERIFIED_ON = FUTURISM_TECHNOLOGIES_CATALOG.verifiedOn
export const CAREERS_URL = FUTURISM_TECHNOLOGIES_CATALOG.companyCareerPage

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

export const hasCloudflareBlockSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('attention required! | cloudflare')
    && normalized.includes('sorry, you have been blocked')
    && normalized.includes('unable to access futurismtechnologies.com')
}

export {collectCurrentFuturism as run} from './currentNative20261121.js'

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
