import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { run as runLifeSigns } from '../lifesigns/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lsdevicespltd'
export const COMPANY = 'LS Devices (P) Ltd'
export const CAREERS_URL = 'https://www.lifesigns.us/careers/'
export const LEGAL_URL = 'https://www.lifesigns.us/terms-of-service/'

const defaultFetchText = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const hasOfficialLegalIdentitySignal = (html) => {
  const page = String(html ?? '')
  const text = page.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
  return /<title>\s*Terms of Service\s*\|\s*Lifesigns(?:\s*\|\s*Lifesigns)?\s*<\/title>/i.test(page)
    && /LS DEVICES PRIVATE LIMITED/i.test(text)
    && /UNDER THE BRAND\s*[‘'“"]?LIFESIGNS/i.test(text)
    && /OPERATES THE WEBSITE\s*\[www\.lifesigns\.us\]/i.test(text)
}

export const createLSDevicesScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchLifeSignsJobs = runLifeSigns } = {}) {
    const legalHtml = await fetchText(LEGAL_URL)
    if (!hasOfficialLegalIdentitySignal(legalHtml)) {
      throw new Error('LS Devices legal identity is no longer verified on LifeSigns')
    }

    const jobs = await fetchLifeSignsJobs()
    if (!Array.isArray(jobs) || jobs.some((job) =>
      job?.source !== 'lifesigns' || job.company !== 'LifeSigns' || job.country !== 'India' || !job.jobId
    )) {
      throw new Error('LS Devices LifeSigns role inventory changed shape')
    }

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      jobId: `${SOURCE}-${job.jobId}`,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'lifesigns.us',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createLSDevicesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
