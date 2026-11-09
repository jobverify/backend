import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://careers.situsamc.com/job-search is the official public SitusAMC careers search page with India locations listed, that https://careers.situsamc.com/work-at-situsamc/corporate-careers/job-opportunities publicly lists India corporate roles including Assistant Manager, Human Resources Business Partner, and that https://careers.situsamc.com/work-at-situsamc/residential-real-estate-careers/job-opportunities publicly lists India residential roles including Senior Underwriter, Shared Services, with public first-party detail pages on careers.situsamc.com.'

export const SITUS_AMC_INDIA_CATALOG = {
  source: 'situsamcindia',
  companyName: 'SitusAMC India',
  officialBrandName: 'SitusAMC',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'situsamcindia/jobs.json',
  homepageUrl: 'https://careers.situsamc.com/',
  companyCareerPage: 'https://careers.situsamc.com/job-search',
  corporateJobsPageUrl: 'https://careers.situsamc.com/work-at-situsamc/corporate-careers/job-opportunities',
  residentialJobsPageUrl: 'https://careers.situsamc.com/work-at-situsamc/residential-real-estate-careers/job-opportunities',
  companyDomain: 'careers.situsamc.com',
  atsPlatform: 'official-company-site-public-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'official-india-job-search-plus-corporate-and-residential-current-job-pages-no-api',
  extractionStrategy:
    'verified-job-search+verified-corporate-jobs-page+verified-residential-jobs-page+india-role-card-links+detail-page-parsing',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedSampleCorporateRoleTitle: 'Assistant Manager, Human Resources Business Partner',
  verifiedSampleResidentialRoleTitle: 'Senior Underwriter, Shared Services',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SITUS_AMC_INDIA_CATALOG
