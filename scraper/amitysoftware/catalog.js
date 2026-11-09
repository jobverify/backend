import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_JOB_DETAIL_URLS = [
  'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
  'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/',
  'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/',
  'https://www.amitysoftware.com/database-architect-financial-systems/',
  'https://www.amitysoftware.com/product-owner-banking-domain/',
  'https://www.amitysoftware.com/subject-matter-expert-insurance-domain/',
  'https://www.amitysoftware.com/senior-expert-software-developer-dot-net/',
  'https://www.amitysoftware.com/front-end-developer-angular/',
]

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://amitysoftware.com/ redirects to the live first-party homepage at https://www.amitysoftware.com/, that the homepage exposes the first-party careers route at https://www.amitysoftware.com/careers/, that the careers page publishes current opening cards for the first-party detail pages https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/, https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/, https://www.amitysoftware.com/lead-devops-engineer-banking-domain/, https://www.amitysoftware.com/database-architect-financial-systems/, https://www.amitysoftware.com/product-owner-banking-domain/, https://www.amitysoftware.com/subject-matter-expert-insurance-domain/, https://www.amitysoftware.com/senior-expert-software-developer-dot-net/, and https://www.amitysoftware.com/front-end-developer-angular/, and that the detail pages expose first-party embedded application forms. Common route checks found https://www.amitysoftware.com/career, https://www.amitysoftware.com/jobs, https://www.amitysoftware.com/join-us, and https://www.amitysoftware.com/openings returning 404 during live verification.'

export const AMITY_SOFTWARE_CATALOG = {
  source: 'amitysoftware',
  companyName: 'Amity Software',
  officialBrandName: 'Amity Software',
  adapter: 'script',
  homepageUrl: 'https://www.amitysoftware.com/',
  companyCareerPage: 'https://www.amitysoftware.com/careers/',
  sitemapUrl: 'https://www.amitysoftware.com/sitemap_index.xml',
  jobDetailUrls: VERIFIED_JOB_DETAIL_URLS,
  companyDomain: 'amitysoftware.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-current-opening-cards',
  extractionStrategy:
    'verified-homepage+verified-careers-page+first-party-opening-cards+first-party-detail-pages-with-embedded-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'amitysoftware/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AMITY_SOFTWARE_CATALOG
