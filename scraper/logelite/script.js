import {runLogeliteNative} from './nativeCareers.js'
import {readCareers} from './nativeModels.js'

export const SOURCE = 'logelite'
export const COMPANY = 'Logelite'
export const HOMEPAGE_URL = 'https://logelite.com/'
export const CAREERS_URL = 'https://logelite.com/career/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Logelite',
  adapter: 'script',
  modulePath: '../../scraper/logelite/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-page-job-cards',
  extractionStrategy: 'paired-current-native-role-pages+complete-declared-pdf-descriptions+literal-own-pdf-country',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'logelite.com',
  verifiedOn: '2026-11-06',
  verifiedSurfaceSummary:
    'Current official careers cards and own role pages declare six complete native two-page PDF descriptions. Literal own PDF location labels, full criteria, employment and experience labels, original bytes and paired closing models are retained. Applications, complete company scope and cleanup remain unverified.',
  dryRunFile: 'logelite/jobs.json',
}

export const hasOfficialCareersSignal = (html = '') => {try {readCareers(html);return true} catch {return false}}
export const extractJobCards = (html = '') => readCareers(html).rows
export const createLogeliteScraper = (defaults = {}) => ({run: (options = {}) => runLogeliteNative({...defaults,...options})})
export const run = (options = {}) => createLogeliteScraper().run(options)
