import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that the exact-name first-party Sankalp Semiconductor site at https://sankalpsemi.hcltech.com/ exposes Careers navigation including a Search Openings handoff to https://sankalpsemi.alchemus.com/ and a job-opportunities contact email, and that the contact page at https://sankalpsemi.hcltech.com/contact/ also directs job seekers to sankalp-recruit@hcl.com. Direct verification of the linked ATS host did not yield a trustworthy public jobs surface on the verified date, so there is no trustworthy public jobs surface available and this provider must fail closed until that official handoff becomes publicly reachable with verifiable openings.'

export const SANKALP_SEMICONDUCTOR_CATALOG = {
  source: 'sankalpsemiconductor',
  companyName: 'Sankalp Semiconductor',
  officialBrandName: 'Sankalp Semiconductor',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sankalpsemiconductor/jobs.json',
  officialHomepageUrl: 'https://sankalpsemi.hcltech.com/',
  contactPageUrl: 'https://sankalpsemi.hcltech.com/contact/',
  companyCareerPage: 'https://sankalpsemi.hcltech.com/',
  searchOpeningsHostUrl: 'https://sankalpsemi.alchemus.com/',
  jobOpportunitiesEmail: 'sankalp-recruit@hcl.com',
  companyDomain: 'sankalpsemi.hcltech.com',
  atsPlatform: 'official-company-site-broken-ats-handoff-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-careers-menu-plus-contact-page-plus-ats-reachability-probe',
  extractionStrategy:
    'verified-homepage-search-openings-handoff+verified-contact-job-opportunities-email+unresolved-ats-host-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SANKALP_SEMICONDUCTOR_CATALOG
