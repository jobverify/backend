import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {ANAND_GROUP_INDIA_CATALOG} from './catalog.js'
import {createCurrentAnandScraper,CAREERS_URL,JOIN_US_URL} from '../anandgroup/currentBoundary.js'
export const SOURCE=ANAND_GROUP_INDIA_CATALOG.source
export const COMPANY=ANAND_GROUP_INDIA_CATALOG.companyName
export const CAREERS_PAGE_URL=CAREERS_URL
export const JOIN_US_PAGE_URL=JOIN_US_URL
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY=ANAND_GROUP_INDIA_CATALOG.verifiedSurfaceSummary
export const createAnandGroupIndiaScraper=defaults=>createCurrentAnandScraper(SOURCE,defaults)
export const run=options=>createAnandGroupIndiaScraper().run(options)
export const scrapeJobs=run
export const name=SOURCE
export const dryRunFile=path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json')
export default {name,dryRunFile,run}
