import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import provider from './catalog.js'
import { createAshbyPairNativeScraper } from '../../scraper-support/shared/ashbyPairNative20261027.js'
import { runCurrentConfiguredProjection } from './currentConfiguredProjection20261121.js'
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const VERIFIED_ON = provider.verifiedOn
export const PROVIDER_METADATA = provider
const terminalCorporate404 = JSON.parse(readFileSync(new URL('./terminalCorporate404.json',import.meta.url)))
export const createLegacyCheckoutComScraper = options => createAshbyPairNativeScraper({"source":"checkoutcom","company":"Checkout.com","token":"checkout.com","domain":"checkout.com","careersUrl":"https://www.checkout.com/careers","proxyUrl":"https://ashby-careers-checkout-production.up.railway.app/api/jobs",terminalCorporate404:terminalCorporate404.routes},options)
export const createCheckoutComScraper = (options={}) => ({run:(runOptions={})=>runCurrentConfiguredProjection({...options,...runOptions})})
export const run = options => createCheckoutComScraper(options).run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
