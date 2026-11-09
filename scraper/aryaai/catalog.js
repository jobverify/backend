import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://arya.ai/ is the live first-party Arya.ai homepage, that it links to the live first-party careers page at https://arya.ai/careers, that https://arya.ai/sitemap.xml publishes the same careers URL, and that the careers page currently exposes one public first-party role card for Senior Data Scientist with department Research, work mode On-site, employment type Full Time, and a direct apply handoff to https://wellfound.com/jobs/3542202-senior-data-scientist. Common route checks found https://arya.ai/career, https://arya.ai/jobs, https://arya.ai/join-us, https://arya.ai/openings, and https://arya.ai/work-with-us returning 404 during live verification. A direct server-side fetch of the Wellfound apply URL returned a JS challenge page, so the scraper trusts the first-party role metadata and preserves the public apply link without depending on Wellfound HTML.'

export const ARYAAI_CATALOG = {
  source: 'aryaai',
  companyName: 'Arya.ai',
  officialBrandName: 'Arya.ai',
  adapter: 'script',
  homepageUrl: 'https://arya.ai/',
  companyCareerPage: 'https://arya.ai/careers',
  sitemapUrl: 'https://arya.ai/sitemap.xml',
  checkedMissingRouteUrls: [
    'https://arya.ai/career',
    'https://arya.ai/jobs',
    'https://arya.ai/join-us',
    'https://arya.ai/openings',
    'https://arya.ai/work-with-us',
  ],
  verifiedApplyUrls: [
    'https://wellfound.com/jobs/3542202-senior-data-scientist',
  ],
  companyDomain: 'arya.ai',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-role-card-surface',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-sitemap+verified-common-missing-routes+first-party-role-cards+external-wellfound-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'aryaai/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ARYAAI_CATALOG
