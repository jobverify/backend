import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified 2026-10-09: https://www.metricstream.com/ links https://www.metricstream.com/about-us/careers.htm with four first-party role cards. The Head of Services listing says Bangalore, India while its head-of-services.html detail says United States; conflicting country scope remains unresolved. The current careers footer also publishes https://www.linkedin.com/company/metricstream. Its native guest jobs feed and current job4468518584 detail independently verify Delivery Manager in Bengaluru, Karnataka, India, country IN, published full JD and native application valid through 2026-10-22. One observed role is returned as a partial India subset; every job and array evidence declares incomplete coverage, global and employer India counts unknown, and prior jobs cannot expire. The previous https://career5.successfactors.eu/career?company=metricstre parser is retained for its verified legacy contract."

export const METRICSTREAM_CATALOG = {
  source: 'metricstream',
  companyName: 'MetricStream',
  officialBrandName: 'MetricStream',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'metricstream/jobs.json',
  homepageUrl: 'https://www.metricstream.com/',
  companyCareerPage: 'https://www.metricstream.com/about-us/careers.htm',
  companyDomain: 'metricstream.com',
  successFactorsCompanyToken: 'metricstre',
  successFactorsBoardUrl: 'https://career5.successfactors.eu/career?company=metricstre',
  successFactorsSearchUrl:
    'https://career5.successfactors.eu/career?company=metricstre&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  legacyVerifiedSampleJobUrl:
    'https://career5.successfactors.eu/career?career_ns=job_listing&company=metricstre&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=3567&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
  atsPlatform: 'official-first-party-job-cards+employer-linkedin-partial+legacy-successfactors',
  countryFilter: 'India',
  linkedinEmployerUrl: 'https://www.linkedin.com/company/metricstream',
  linkedinJobsUrl: 'https://www.linkedin.com/company/metricstream/jobs',
  verifiedSampleJobUrl: 'https://in.linkedin.com/jobs/view/delivery-manager-at-metricstream-4468518584',
  sourceListingComplete: false,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedObservedIndiaSubsetCount: 1,
  verifiedObservedEmployerFeedCardCount: 2,
  verificationDisposition: 'partial-employer-india-subset-with-unresolved-primary-location-conflict',
  paginationStrategy: 'first-party-role-cards+partial-employer-linkedin-snapshot+legacy-successfactors-dwr',
  extractionStrategy:
    'verified-first-party-homepage+country-conflict-preserved+employer-linkedin-identity-country-jd-expiry+partial-india-subset+legacy-successfactors',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default METRICSTREAM_CATALOG
