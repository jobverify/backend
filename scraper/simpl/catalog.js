import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 26, 2026 that the current official Simpl pages at https://www.get-simpl.com/index.html and https://www.get-simpl.com/about.html identify the fintech brand, show a non-linked Careers footer label, and expose no trustworthy public jobs board or linked first-party careers route. The older reference page at https://sandbox.getsimpl.com/about-us/ no longer resolves upstream and is not linked from the current verified first-party site. As of the verified date, no trustworthy public jobs surface was exposed on the verified live Simpl pages.'

export const SIMPL_CATALOG = {
  source: 'simpl',
  companyName: 'Simpl',
  officialBrandName: 'Simpl',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'simpl/jobs.json',
  homepageUrl: 'https://www.get-simpl.com/index.html',
  aboutPageUrl: 'https://www.get-simpl.com/about.html',
  careersReferencePageUrl: 'https://sandbox.getsimpl.com/about-us/',
  companyDomain: 'get-simpl.com',
  atsPlatform: 'official-company-site-no-trustworthy-public-jobs-surface',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-about-page-no-public-job-listings',
  extractionStrategy:
    'verified-homepage+verified-about-page+return-empty-when-no-public-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-26',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SIMPL_CATALOG
