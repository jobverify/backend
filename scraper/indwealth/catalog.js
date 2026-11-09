import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INDWEALTH_CATALOG = {
  source: 'indwealth',
  companyName: 'INDwealth',
  officialBrandName: 'INDmoney',
  adapter: 'script',
  companyCareerPage: 'https://www.indmoney.com/about',
  officialRedirectSourceUrl: 'https://www.indwealth.in/',
  officialBrandHomepageUrl: 'https://www.indmoney.com/',
  officialAboutUrl: 'https://www.indmoney.com/about',
  linkedinCompanyJobsUrl: 'https://www.linkedin.com/company/indmoney/jobs/',
  linkedinCompanyPageUrl: 'https://in.linkedin.com/company/indmoney',
  publicLinkedInJobsUrl: 'https://in.linkedin.com/jobs/indmoney-jobs',
  atsPlatform: 'linkedin-guest-search',
  countryFilter: 'India',
  paginationStrategy: 'blocked-first-party-redirect-and-about-plus-public-company-search-page',
  extractionStrategy:
    'verified-blocked-brand-redirect+verified-blocked-about-page+verified-linkedin-company-page+public-linkedin-company-search+optional-public-detail-jsonld',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'indmoney.com',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that https://www.indwealth.in/ now returns an HTTP 403 Cloudflare "Just a moment..." challenge while still resolving to https://www.indmoney.com/, and that both https://www.indmoney.com/ and https://www.indmoney.com/about return the same first-party challenge shell in this environment. Also verified that the public LinkedIn company surface at https://www.linkedin.com/company/indmoney/jobs/ still resolves to https://in.linkedin.com/company/indmoney, and that the public LinkedIn guest jobs page at https://in.linkedin.com/jobs/indmoney-jobs still exposes exact-company India roles including Founder\'s Office - Growth, Product Manager - Lending, Anchor and Content Creator, Customer Support Executive, and Senior Analyst - Growth. This remains a direct provider because the verified public LinkedIn company and jobs surfaces are still reachable even while the first-party INDwealth and INDmoney routes are challenge-blocked.',
  dryRunFile: 'indwealth/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INDWEALTH_CATALOG
