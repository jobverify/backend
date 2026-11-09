import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INDUSTRY_BUYING_CATALOG = {
  source: 'industrybuying',
  companyName: 'IndustryBuying',
  officialBrandName: 'IndustryBuying',
  adapter: 'script',
  companyCareerPage: 'https://jobs.industrybuying.com/jobs',
  officialHomepageUrl: 'https://www.industrybuying.com/',
  officialCareersHandoffPageUrl: 'https://www.industrybuying.com/',
  officialJobsSiteUrl: 'https://jobs.industrybuying.com/',
  careersApiBaseUrl: 'https://careers.industrybuying.com/api/career',
  careersOrgsApiUrl: 'https://careers.industrybuying.com/api/career/orgs',
  careersJobsApiUrl: 'https://careers.industrybuying.com/api/career/jobs',
  expectedOrgId: 'org_1782819232623',
  expectedOrgSlug: 'industrybuying',
  atsPlatform: 'custom-first-party-next-careers-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-api-single-page',
  extractionStrategy:
    'verified-first-party-homepage-handoff+verified-first-party-jobs-site+verified-careers-api-jobs-and-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'industrybuying.com',
  verifiedOn: '2026-11-05',
  verifiedPublicJobCount: 5,
  verifiedIndiaJobCount: null,
  verifiedSampleJobTitle: 'Senior Manager HR',
  verifiedSampleJobUrl: 'https://jobs.industrybuying.com/jobs/detail?id=job_1790074749288',
  verifiedSurfaceSummary:
    'Observed on November 5, 2026: the official IndustryBuying homepage links https://jobs.industrybuying.com/ and the public https://careers.industrybuying.com/api/career/jobs inventory and own-org detail models expose five roles, including Senior Manager HR and Online Sales Executive. Full original role criteria and requisition identities are retained. The native location fields contain office labels such as Delhi HO and New Delhi without an explicit work country. All five countries remain unknown; no India count, complete company inventory or lifecycle cleanup is qualified.',
  dryRunFile: 'industrybuying/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INDUSTRY_BUYING_CATALOG
