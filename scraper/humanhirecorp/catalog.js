import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HUMANHIRECORP_CATALOG = {
  source: 'humanhirecorp',
  companyName: 'HumanHire Corp',
  officialBrandName: 'HumanHire Corp',
  adapter: 'script',
  homepageUrl: 'https://humanhirecorp.com/',
  companyCareerPage: 'https://humanhirecorp.com/life-at-humanhire',
  atsPlatform: 'first-party-spa-recruitment-site-no-exact-name-employer-jobs',
  countryFilter: 'India',
  paginationStrategy: 'spa-shell-validation-across-brand-pages',
  extractionStrategy: 'verified-recruitment-site-spa-shell-without-ssr-employer-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'humanhirecorp.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://humanhirecorp.com/leadership-board and https://humanhirecorp.com/life-at-humanhire remained exact-name HumanHire Corp brand pages, that browser-rendered evidence presented HumanHire Corp as a global recruitment and staffing business rather than an employer-specific jobs board, and that the raw first-party HTML fetched on the verified date was only a Vite SPA shell with the Global Recruitment & Staffing Solutions title, asset bundle, and <div id="root"></div> rather than any trustworthy server-rendered exact-name employer openings.',
  dryRunFile: 'humanhirecorp/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default HUMANHIRECORP_CATALOG
