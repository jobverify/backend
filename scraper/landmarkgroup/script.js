import { buildOracleSearchUrl, buildOracleJobUrl, createOracleNativeScraper, extractOracleDiscovery } from '../arcelormittal/oracleNative.js'
export const LISTING_API_BASE_URL = 'https://efhi.fa.em3.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const PUBLIC_JOBS_BASE_URL = 'https://efhi.fa.em3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/'
export const SITE_NUMBER = 'CX_1'
export const DEFAULT_LOCATION = null
export const DEFAULT_LIMIT = 24
export const buildSearchUrl = options => buildOracleSearchUrl('landmarkgroup', options)
export const buildJobDetailUrl = id => buildOracleJobUrl('landmarkgroup', id)
export const extractSearchResults = payload => extractOracleDiscovery('landmarkgroup', payload)
export const createLandmarkGroupScraper = options => createOracleNativeScraper('landmarkgroup', options)
export const run = options => createLandmarkGroupScraper().run(options)
