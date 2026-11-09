import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://dalisec.com/, https://dalisec.com/sitemap-index.xml, and checked first-party careers routes such as https://dalisec.com/careers and https://dalisec.com/jobs currently return a Cloudflare 526 Invalid SSL certificate edge error ("error code: 526"). Because the first-party hostname no longer exposes a trustworthy public surface, this provider remains fail-closed and returns no jobs until Dalisec restores a verifiable first-party site.'

export const DALISEC_CATALOG = {
  source: 'dalisec',
  companyName: 'Dalisec',
  officialBrandName: 'Dalisec',
  adapter: 'script',
  homepageUrl: 'https://dalisec.com/',
  companyCareerPage: 'https://dalisec.com/',
  sitemapUrl: 'https://dalisec.com/sitemap-index.xml',
  checkedCareersRouteUrls: [
    'https://dalisec.com/careers',
    'https://dalisec.com/career',
    'https://dalisec.com/jobs',
    'https://dalisec.com/join-us',
    'https://dalisec.com/openings',
    'https://dalisec.com/current-openings',
    'https://dalisec.com/work-with-us',
  ],
  companyDomain: 'dalisec.com',
  atsPlatform: 'official-company-site-untrustworthy-edge-error-sentinel',
  countryFilter: 'India',
  paginationStrategy: 'homepage-edge-error-fail-closed-validation',
  extractionStrategy: 'verified-cloudflare-526-edge-error-surface+fail-closed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'dalisec/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DALISEC_CATALOG
