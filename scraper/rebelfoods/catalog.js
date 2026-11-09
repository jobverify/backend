import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.rebelfoods.com/join-our-team is the live official Rebel Foods careers page and that it instructs applicants to email careers@rebelfoods.com. No trustworthy public jobs surface was exposed on the exact company domain: the verified first-party page exposed no inline job cards, no public ATS handoff, and no other trustworthy public jobs surface, so this provider is pinned as a fail-closed sentinel that returns no jobs until a real public jobs board appears.'

export const REBEL_FOODS_CATALOG = {
  source: 'rebelfoods',
  companyName: 'Rebel Foods',
  officialBrandName: 'Rebel Foods',
  adapter: 'script',
  homepageUrl: 'https://www.rebelfoods.com/',
  companyCareerPage: 'https://www.rebelfoods.com/join-our-team',
  officialCareersEmail: 'careers@rebelfoods.com',
  companyDomain: 'rebelfoods.com',
  atsPlatform: 'official-company-careers-email-apply',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-validation-only',
  extractionStrategy: 'verified-first-party-careers-page+email-apply-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'rebelfoods/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default REBEL_FOODS_CATALOG
