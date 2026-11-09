import provider from './catalog.js'
import { createGreenhousePairScraper } from '../../scraper-support/shared/greenhousePairNative20261027.js'
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const run = options => createGreenhousePairScraper(provider).run(options)
