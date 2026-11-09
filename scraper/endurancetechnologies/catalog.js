import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.endurancegroup.com/ is the live first-party Endurance Technologies Limited homepage, that https://www.endurancegroup.com/careers/ is the live first-party careers landing page with a Job Portal handoff to https://www.endurancegroup.com/careers/job-portal/, and that the browser-rendered first-party job portal currently exposes 6 public openings with same-domain detail pages including https://www.endurancegroup.com/career/technical-architect/, https://www.endurancegroup.com/career/technical-lead-hardware/, https://www.endurancegroup.com/career/technical-member-hardware/, https://www.endurancegroup.com/career/technical-lead-software/, https://www.endurancegroup.com/career/technical-member-software/, and https://www.endurancegroup.com/career/technical-member-verification-validation/. Direct Node fetch probes against the official careers URLs returned a 403 "Just a moment..." interstitial, so the trusted public contract is the browser-rendered first-party Endurance job portal plus same-domain detail pages.'

export const ENDURANCE_TECHNOLOGIES_CATALOG = {
  source: 'endurancetechnologies',
  companyName: 'Endurance Technologies',
  officialBrandName: 'Endurance Technologies Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'endurancetechnologies/jobs.json',
  homepageUrl: 'https://www.endurancegroup.com/',
  companyCareerPage: 'https://www.endurancegroup.com/careers/',
  jobPortalUrl: 'https://www.endurancegroup.com/careers/job-portal/',
  verifiedJobUrls: [
    'https://www.endurancegroup.com/career/technical-architect/',
    'https://www.endurancegroup.com/career/technical-lead-hardware/',
    'https://www.endurancegroup.com/career/technical-member-hardware/',
    'https://www.endurancegroup.com/career/technical-lead-software/',
    'https://www.endurancegroup.com/career/technical-member-software/',
    'https://www.endurancegroup.com/career/technical-member-verification-validation/',
  ],
  companyDomain: 'endurancegroup.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-job-portal-page-plus-detail-pages',
  extractionStrategy:
    'verified-careers-landing-page+browser-rendered-first-party-job-portal+same-domain-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ENDURANCE_TECHNOLOGIES_CATALOG
