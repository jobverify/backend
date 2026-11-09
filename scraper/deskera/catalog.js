import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DESKERA_CATALOG = {
  source: 'deskera',
  companyName: 'Deskera',
  adapter: 'script',
  homepageUrl: 'https://www.deskera.com/',
  companyCareerPage: 'https://www.linkedin.com/jobs/deskera-jobs',
  linkedinCompanyPageUrl: 'https://www.linkedin.com/company/deskera/',
  companyDomain: 'deskera.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-linkedin-guest-search-handoff',
  extractionStrategy:
    'verified-homepage+verified-linkedin-company-page+verified-linkedin-guest-search-handoff-without-exact-deskera-board-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://www.deskera.com/ redirects to the live official Deskera homepage at https://www.deskera.com/in, that its Careers navigation still links to https://www.linkedin.com/jobs/deskera-jobs, that https://www.linkedin.com/company/deskera/ remains the live public Deskera LinkedIn company page listing https://www.deskera.com as the website and Bengaluru, 560066, IN as one of the locations, and that the Careers handoff now resolves to a generic LinkedIn guest jobs search page rather than a dedicated Deskera company jobs board. The verified public surface therefore exposes no trustworthy public Deskera jobs listing on August 1, 2026.',
  dryRunFile: 'deskera/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DESKERA_CATALOG
