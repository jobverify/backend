import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified on September 13, 2026 that the live Expedia Group careers homepage links its public expedia.wd108.myworkdayjobs.com/en-US/search tenant through candidate account and talent network links. The legacy first-party /jobs/ index still exists but ordinary requests receive HTTP 403 Access denied. The linked Workday board and public CXS search API respond successfully; the unfiltered API declares all current India locations as India - Bangalore and India - Gurgaon. Their OR filter returns 10 unique current India roles. The authoritative ATS inventory reports 156 global roles, independently of the legacy WordPress index reporting 202. Complete API pagination and India scope checks are retained; location IDs cover the currently declared India offices."

export const EXPEDIA_CATALOG = {
  source: 'expedia',
  companyName: 'Expedia',
  officialBrandName: 'Expedia Group',
  adapter: 'script',
  homepageUrl: 'https://careers.expediagroup.com/',
  companyCareerPage: 'https://careers.expediagroup.com/',
  jobsPageUrl: 'https://careers.expediagroup.com/jobs/',
  baseUrl: "https://expedia.wd108.myworkdayjobs.com/search?locations=c553432013ba103bbc5b28efceb250b1&locations=c553432013ba103bbc5cc6e3faef5396",
  jobsApiUrl: "https://expedia.wd108.myworkdayjobs.com/wday/cxs/expedia/search/jobs",
  verifiedNextPageUrl: 'https://careers.expediagroup.com/jobs/?&mypage=1',
  sampleIndiaJobDetailUrl:
    'https://careers.expediagroup.com/job/machine-learning-engineer-ii/gurgaon-hary-na/R-108134/',
  sampleIndiaApplyUrl:
    'https://expedia.wd108.myworkdayjobs.com/search/job/India---Gurgaon/Machine-Learning-Engineer-II_R-108134/apply?',
  companyDomain: 'expediagroup.com',
  atsPlatform: 'workday-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'workday-cxs-offset-with-complete-inventory-check',
  extractionStrategy:
    'officially-linked-workday-cxs+verified-india-location-facets+workday-detail-enrichment',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'expedia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EXPEDIA_CATALOG
