import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that https://droom.in/ remained the live first-party Droom homepage with canonical https://droom.in and a first-party /career handoff, even though the homepage no longer rendered a literal text Careers anchor. Verified that https://droom.in/career remained the live first-party careers surface titled "Career" with Career, Jobs, and Campus Hiring tabs, an inline "Now Hiring" section exposing 21 public job cards, collapsible on-page job descriptions, and a shared first-party "Apply at Droom" application form at https://droom.in/career#career-form that posts back to https://droom.in/career. Verified that alternate first-party routes https://droom.in/careers, https://droom.in/jobs, https://droom.in/join-us, and https://droom.in/openings returned first-party 404 pages during live GET checks, so the trusted public jobs surface is the single inline board on https://droom.in/career rather than a separate ATS.'

export const DROOM_CATALOG = {
  source: 'droom',
  companyName: 'Droom',
  officialBrandName: 'Droom',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'droom/jobs.json',
  homepageUrl: 'https://droom.in/',
  companyCareerPage: 'https://droom.in/career',
  applicationFormUrl: 'https://droom.in/career#career-form',
  verified404RouteUrls: [
    'https://droom.in/careers',
    'https://droom.in/jobs',
    'https://droom.in/join-us',
    'https://droom.in/openings',
  ],
  companyDomain: 'droom.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-inline-job-cards-on-single-first-party-careers-page',
  extractionStrategy:
    'verified-homepage+verified-first-party-careers-page+inline-job-cards+shared-first-party-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DROOM_CATALOG
