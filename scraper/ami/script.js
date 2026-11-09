import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createCurrentAmiScraper,PROFILE,SEARCH} from './currentBoundary.js'
export const LINKEDIN_COMPANY_PAGE_URL=PROFILE
export const LINKEDIN_INDIA_JOBS_URL=SEARCH
export const createAmiScraper=defaults=>createCurrentAmiScraper(defaults)
export const run=options=>createAmiScraper().run(options)
export const scrapeJobs=run
export const name='ami'
export const dryRunFile=path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json')
export default {name,dryRunFile,run}
