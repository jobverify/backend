import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectCareers, runNative } from './nativeCareers.js'

import { CYBERTECH_SYSTEMS_AND_SOFTWARE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

export const hasOfficialCareersSignal = (html = '') => inspectCareers(html).identity
export const extractJobCards = (html = '') => inspectCareers(html).roleLinks.map(link => ({
  title: link.title, sourceUrl: link.url, applyUrl: link.url, employmentType: null, experienceRequired: null,
}))

export const createCybertechSystemsAndSoftwareScraper = ({ maxJobs = null, now: defaultNow = () => new Date().toISOString() } = {}) => ({
  run: (options = {}) => runNative({ ...options, maxJobs, now: options.now || defaultNow }),
})

export const run = async (options = {}) => createCybertechSystemsAndSoftwareScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
