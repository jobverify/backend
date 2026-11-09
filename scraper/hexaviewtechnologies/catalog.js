import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HEXAVIEW_TECHNOLOGIES_CATALOG = {
  source: 'hexaviewtechnologies',
  companyName: 'HexaView Technologies',
  officialBrandName: 'Hexaview Technologies',
  adapter: 'script',
  homepageUrl: 'https://www.hexaviewtech.com/',
  companyCareerPage: 'https://www.hexaviewtech.com/corporate-overview/careers',
  jobListingUrl: 'https://www.hexaviewtech.com/job-listing',
  companyDomain: 'hexaviewtech.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'finsweet-cms-load-more-pagination',
  extractionStrategy: 'verified-first-party-webflow-jobs-page+relative-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.hexaviewtech.com/corporate-overview/careers is the live first-party Hexaview careers landing page and that it routes to the public first-party jobs surface at https://www.hexaviewtech.com/job-listing. The verified job board exposes public role cards such as Automation QA Engineer, Full Stack Developer, Program Manager, and Senior .Net Developer, with relative Apply Now links and a visible Load More Opportunities paginator.',
  dryRunFile: 'hexaviewtechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HEXAVIEW_TECHNOLOGIES_CATALOG
