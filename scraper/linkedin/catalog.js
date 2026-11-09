import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LINKEDIN_CATALOG = {
  source: 'linkedin',
  companyName: 'LinkedIn',
  officialBrandName: 'LinkedIn',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.linkedin.com/jobs/search/?f_C=1337&geoId=102713980',
  homepageUrl: 'https://www.linkedin.com/',
  verifiedRoleUrls: [
    'https://in.linkedin.com/jobs/view/account-manager-linkedin-talent-solutions-at-linkedin-4422287519',
    'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054',
  ],
  companyDomain: 'linkedin.com',
  atsPlatform: 'linkedin-public-jobs-search',
  countryFilter: 'India',
  paginationStrategy: 'single-public-company-filtered-jobs-search-plus-public-detail-pages',
  extractionStrategy: 'verified-linkedin-public-jobs-search+company-filtered-listing-cards+public-jobposting-jsonld-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'linkedin/jobs.json',
  verifiedOn: '2026-10-09',
  verifiedSurfaceSummary:
    "Verified on October 9, 2026 that the public LinkedIn guest jobs search at https://www.linkedin.com/jobs/search/?f_C=1337&geoId=102713980 exposed 47 unique company-filtered LinkedIn jobs in India. The current India canonical alias is trusted only with the exact company and India filters and selected company input. All 47 public detail pages were fetched and matched their listing titles, LinkedIn employer identity, explicit India geography and full job descriptions. Both ordinary and new-date listing cards are parsed; caller caps or advertised-count disagreement are marked incomplete.",
}

export default LINKEDIN_CATALOG
