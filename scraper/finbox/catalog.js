import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FINBOX_CATALOG = {
  source: 'finbox',
  companyName: 'FinBox',
  officialBrandName: 'FinBox',
  adapter: 'script',
  homepageUrl: 'https://www.finbox.in/',
  companyCareerPage: 'https://www.finbox.in/careers',
  careersPageUrl: 'https://www.finbox.in/careers',
  jobsEmbedUrl: 'https://jobs.reczee.com/finbox/job-embed',
  companyDetailsApiUrl: 'https://app.reczee.com/api/v1/company/get-careers-page-details?company_slug=finbox',
  requisitionsApiUrl: 'https://app.reczee.com/api/v1/requisitions/get-open-requisitions?company_slug=finbox',
  jobDetailUrlTemplate: 'https://jobs.reczee.com/finbox/{slug}',
  jobApplyUrlTemplate: 'https://jobs.reczee.com/finbox/{slug}/apply',
  sampleJobSlug: 'IGCBY',
  sampleJobDetailApiUrl: 'https://app.reczee.com/api/v1/requisitions/from-slug/IGCBY?company_slug=finbox',
  sampleJobDetailUrl: 'https://jobs.reczee.com/finbox/IGCBY',
  sampleJobApplyUrl: 'https://jobs.reczee.com/finbox/IGCBY/apply',
  companyDomain: 'finbox.in',
  atsPlatform: 'reczee',
  countryFilter: 'Global',
  paginationStrategy: 'first-party-careers-handoff-plus-reczee-open-requisitions-api',
  extractionStrategy: 'verified-first-party-careers-shell+verified-reczee-company-details+verified-reczee-open-requisitions-feed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.finbox.in/careers is the live first-party FinBox careers page, that its public handoff is https://jobs.reczee.com/finbox/job-embed, that the Reczee company contract is exposed at https://app.reczee.com/api/v1/company/get-careers-page-details?company_slug=finbox, and that live openings are exposed at https://app.reczee.com/api/v1/requisitions/get-open-requisitions?company_slug=finbox. Sample public routes verified from the live feed included https://jobs.reczee.com/finbox/IGCBY, https://jobs.reczee.com/finbox/IGCBY/apply, and https://app.reczee.com/api/v1/requisitions/from-slug/IGCBY?company_slug=finbox.',
  dryRunFile: 'finbox/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FINBOX_CATALOG
