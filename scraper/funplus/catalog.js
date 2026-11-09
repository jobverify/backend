import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://funplus.com/ is the live first-party homepage for FunPlus, that https://funplus.com/careers/ is the live first-party careers page, and that it embeds the public Factorial jobs board at https://funplus.factorialhr.com/embed/jobs. Verified that the public board and sitemap at https://funplus.factorialhr.com/embed/jobs and https://funplus.factorialhr.com/sitemap.xml exposed 2 public Factorial roles on July 15, 2026, with live sample detail pages at https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342 and https://funplus.factorialhr.com/embed/job_posting/senior-brand-manager-gaming-310659.'

export const FUNPLUS_CATALOG = {
  source: 'funplus',
  companyName: 'FunPlus',
  officialBrandName: 'FunPlus',
  adapter: 'script',
  homepageUrl: 'https://funplus.com/',
  companyCareerPage: 'https://funplus.com/careers/',
  jobsBoardUrl: 'https://funplus.factorialhr.com/embed/jobs',
  jobsSitemapUrl: 'https://funplus.factorialhr.com/sitemap.xml',
  sampleDetailUrl: 'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342',
  sampleApplyUrl: 'https://funplus.factorialhr.com/embed/apply/community-manager-intern-298342',
  atsPlatform: 'factorialhr-embed-jobs-html',
  paginationStrategy: 'single-verified-public-factorial-embed-board',
  extractionStrategy: 'verified-first-party-careers-iframe+factorial-board-html+detail-pages+sitemap-lastmod',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'funplus.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default FUNPLUS_CATALOG
