import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 2, 2026 that the exact-name Fullerton India homepage at https://fullertonindia.com/ now redirects to the live SMFG India Credit site at https://www.smfgindiacredit.com/, that the homepage and careers surface are now rendered with attributed Next.js title tags while preserving the same careers handoff to https://www.smfgindiacredit.com/careers.aspx, and that the first-party careers page still exposes the public Workline jobs entry URL https://app52.workline.hr/Candidate/GeneralOpening.aspx which resolves to https://app52.workline.hr/Cportal/GeneralOpening.aspx. The scraper uses the standard public Workline listing endpoint https://app52.workline.hr/CPortal/generalopening.aspx/GetCurrentopening for extraction and fails closed if that public contract differs at runtime.'

export const FULLERTON_INDIA_CATALOG = {
  source: 'fullertonindia',
  companyName: 'Fullerton India',
  officialBrandName: 'SMFG India Credit',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'fullertonindia/jobs.json',
  homepageUrl: 'https://fullertonindia.com/',
  redirectedHomepageUrl: 'https://www.smfgindiacredit.com/',
  companyCareerPage: 'https://www.smfgindiacredit.com/careers.aspx',
  jobsBoardEntryUrl: 'https://app52.workline.hr/Candidate/GeneralOpening.aspx',
  jobsBoardUrl: 'https://app52.workline.hr/Cportal/GeneralOpening.aspx',
  jobsApiUrl: 'https://app52.workline.hr/CPortal/generalopening.aspx/GetCurrentopening',
  companyDomain: 'fullertonindia.com',
  atsPlatform: 'workline-public-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-homepage-redirect-plus-first-party-careers-handoff-plus-workline-current-opening-api',
  extractionStrategy:
    'verified-first-party-handoff+current-native-India-listing+paired-public-role+published-view-only-full-PDF-description',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default FULLERTON_INDIA_CATALOG
