import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that the live first-party Eventus Security homepage is https://eventussecurity.com/, that it links to the public careers page at https://eventussecurity.com/careers/, and that the careers page is titled "Cybersecurity Careers at Eventus - Join Our Mission" with canonical https://eventussecurity.com/careers/ and a visible "Current Openings" section. Verified first-party job detail pages including https://eventussecurity.com/careers/strategic-account-manager/, where the exact public contract exposes the role title Strategic Account Manager, location and experience fields, a Job Description block, and an Apply Now handoff to https://eventustechsol.zohorecruit.in/forms/234cd2dce76f704db02335da982b9fcfc73ec6fc2a1397622b31133ec570d8a3. Verified that the careers page also shows a non-India Dubai, UAE role, so the scraper is pinned to the verified India subset only. Verified homepage: https://eventussecurity.com/'

export const EVENTUS_SECURITY_CATALOG = {
  source: 'eventussecurity',
  companyName: 'Eventus Security',
  officialBrandName: 'Eventus Security',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'eventussecurity/jobs.json',
  homepageUrl: 'https://eventussecurity.com/',
  companyCareerPage: 'https://eventussecurity.com/careers/',
  canonicalCareerUrl: 'https://eventussecurity.com/careers/',
  verifiedJobDetailUrl: 'https://eventussecurity.com/careers/strategic-account-manager/',
  verifiedApplyUrl: 'https://eventustechsol.zohorecruit.in/forms/234cd2dce76f704db02335da982b9fcfc73ec6fc2a1397622b31133ec570d8a3',
  atsPlatform: 'first-party-careers-page-plus-first-party-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-openings-page',
  extractionStrategy:
    'verified-homepage+verified-current-openings-page+first-party-job-detail-pages+india-filter+zoho-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'eventussecurity.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EVENTUS_SECURITY_CATALOG
