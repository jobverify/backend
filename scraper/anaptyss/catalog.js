import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_JOB_DETAIL_URLS = [
  'https://www.anaptyss.com/job-post/quality-analyst-qa/',
  'https://www.anaptyss.com/job-post/risk-lines-of-defense-professionals/',
  'https://www.anaptyss.com/job-post/assistant-manager-banking-backend-operations/',
  'https://www.anaptyss.com/job-post/solution-consulting-lead/',
  'https://www.anaptyss.com/job-post/senior-data-architect-modeling-specialist/',
  'https://www.anaptyss.com/job-post/alteryx-designer-server-admin/',
  'https://www.anaptyss.com/job-post/senior-analyst-advisory-professional-services-bfsi/',
  'https://www.anaptyss.com/job-post/full-stack-developer-microsoft-azure-technology/',
]

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://anaptyss.com/ redirects to the live first-party homepage at https://www.anaptyss.com/, that the homepage links to the first-party careers landing page at https://www.anaptyss.com/careers/, that the careers landing page routes applicants to the first-party jobs page at https://www.anaptyss.com/jobs/, that https://www.anaptyss.com/sitemap.xml redirects to https://www.anaptyss.com/sitemap_index.xml and publishes the jobs sitemap at https://www.anaptyss.com/job_post-sitemap.xml, and that the jobs page and jobs sitemap both expose the current first-party detail pages https://www.anaptyss.com/job-post/quality-analyst-qa/, https://www.anaptyss.com/job-post/risk-lines-of-defense-professionals/, https://www.anaptyss.com/job-post/assistant-manager-banking-backend-operations/, https://www.anaptyss.com/job-post/solution-consulting-lead/, https://www.anaptyss.com/job-post/senior-data-architect-modeling-specialist/, https://www.anaptyss.com/job-post/alteryx-designer-server-admin/, https://www.anaptyss.com/job-post/senior-analyst-advisory-professional-services-bfsi/, and https://www.anaptyss.com/job-post/full-stack-developer-microsoft-azure-technology/. The detail pages expose first-party Apply Now links to the shared first-party application page under https://www.anaptyss.com/apply-now/. Common route checks found https://www.anaptyss.com/career/ and https://www.anaptyss.com/openings/ returning 404 during live verification. On October 3, 2026, the redesigned first-party homepage linked to https://www.anaptyss.com/careers/openings, which listed eight India roles with working job detail pages and apply links; the former /careers/, /jobs/, and sitemap routes now return 404.'

export const ANAPTYSS_CATALOG = {
  source: 'anaptyss',
  companyName: 'Anaptyss',
  officialBrandName: 'Anaptyss Inc.',
  adapter: 'script',
  homepageUrl: 'https://www.anaptyss.com/',
  careersLandingUrl: 'https://www.anaptyss.com/careers/',
  companyCareerPage: 'https://www.anaptyss.com/careers/openings',
  legacyJobsUrl: 'https://www.anaptyss.com/jobs/',
  sitemapUrl: 'https://www.anaptyss.com/sitemap_index.xml',
  jobPostSitemapUrl: 'https://www.anaptyss.com/job_post-sitemap.xml',
  sharedApplyPageUrl: 'https://www.anaptyss.com/apply-now/',
  jobDetailUrls: VERIFIED_JOB_DETAIL_URLS,
  companyDomain: 'anaptyss.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'current-first-party-openings-list-and-detail-pages-with-legacy-sitemap-fallback',
  extractionStrategy:
    'verified-current-homepage+current-openings-list+india-detail-pages+shared-first-party-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'anaptyss/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ANAPTYSS_CATALOG
