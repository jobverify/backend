import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.everestind.com/ is the live first-party Everest Industries Limited homepage, that it links candidates to the official first-party careers page at https://www.everestind.com/careerateverest, and that this first-party careers page exposes 13 public openings as inline HTML cards with role-specific Darwinbox apply handoffs such as https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a699eb89c55aca___apply=1. Verified that https://oneeverest.darwinbox.in/jobs resolves to the public Everest Darwinbox shell at https://oneeverest.darwinbox.in/ms/candidatev2/main/careers/home and that https://oneeverest.darwinbox.in/ms/candidatev2/main/careers/allJobs is live with the Everest Industries title. Direct non-browser requests to the Darwinbox candidate API at https://oneeverest.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main returned a Cloudflare 403 during verification, so this scraper uses the verified first-party HTML job cards and the published Darwinbox apply handoffs.'

export const EVEREST_INDUSTRIES_CATALOG = {
  source: 'everestindustries',
  companyName: 'Everest Industries',
  officialBrandName: 'Everest Industries Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'everestindustries/jobs.json',
  homepageUrl: 'https://www.everestind.com/',
  companyCareerPage: 'https://www.everestind.com/careerateverest',
  darwinboxPublicPortalUrl: 'https://oneeverest.darwinbox.in/jobs',
  darwinboxHomeUrl: 'https://oneeverest.darwinbox.in/ms/candidatev2/main/careers/home',
  darwinboxAllJobsUrl: 'https://oneeverest.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  darwinboxApplyUrlExample:
    'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a699eb89c55aca___apply=1',
  companyDomain: 'everestind.com',
  atsPlatform: 'official-company-careers-plus-darwinbox-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-html',
  extractionStrategy:
    'homepage-careers-link+inline-first-party-job-cards+darwinbox-apply-handoff+darwinbox-shell-checks',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EVEREST_INDUSTRIES_CATALOG
