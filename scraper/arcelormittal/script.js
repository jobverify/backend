import { buildOracleSearchUrl, buildOracleJobUrl, createOracleNativeScraper, extractOracleDiscovery } from './oracleNative.js'
export const API_BASE_URL = 'https://emfg.fa.em4.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const PUBLIC_CAREERS_BASE_URL = 'https://emfg.fa.em4.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_4001/job/'
export const SITE_NUMBER = 'CX_4001'
export const DEFAULT_LOCATION = null
export const DEFAULT_LIMIT = 24
export const buildSearchUrl = options => buildOracleSearchUrl('arcelormittal', options)
export const buildJobDetailUrl = id => buildOracleJobUrl('arcelormittal', id)
export const extractSearchResults = payload => extractOracleDiscovery('arcelormittal', payload)
export const createArcelorMittalScraper = options => createOracleNativeScraper('arcelormittal', options)
export const run = options => createArcelorMittalScraper().run(options)
