import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
export const SOURCE = 'asapp'
export const COMPANY = 'ASAPP'
export const CAREERS_URL = 'https://www.asapp.com/careers'
export const createASAPPScraper = options => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.asapp, options)
export const run = options => createASAPPScraper().run(options)
